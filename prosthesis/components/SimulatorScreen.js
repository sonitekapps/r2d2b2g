/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let Ci = Components.interfaces;
let Cc = Components.classes;
let Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

Cu.import("resource://prosthesis/modules/GlobalSimulatorScreen.jsm");

dump("SIMULATOR SCREEN COMPONENT LOADING\n");

function SimulatorScreen() {}
SimulatorScreen.prototype = {
  classID:         Components.ID("{c83c02c0-5d43-4e3e-987f-9173b313e880}"),
  QueryInterface:  XPCOMUtils.generateQI([Ci.nsIDOMGlobalPropertyInitializer,
                                          Ci.nsISupportsWeakReference]),
  classInfo: XPCOMUtils.generateCI({
    classID: Components.ID("{c83c02c0-5d43-4e3e-987f-9173b313e880}"),
    contractID: "@mozilla.org/simulator-screen;1",
    classDescription: "mozSimulatorScreen",
    interfaces: [Ci.nsIDOMGlobalPropertyInitializer,
                 Ci.nsISupportsWeakReference],
    flags: Ci.nsIClassInfo.DOM_OBJECT
  }),

  _getOrigin: function(aURL) {
    let uri = Services.io.newURI(aURL, null, null);
    return uri.prePath;
  },

  _fixAppIframe: function(appOrigin) {
    Services.obs.notifyObservers(
      {
        wrappedJSObject: {
          appOrigin: appOrigin
        }
      }, 
      "simulator-fix-app-iframe", 
      null);
  },

  init: function (aWindow) {
    let globalScreen = GlobalSimulatorScreen;
    let nodePrincipal = aWindow.document.nodePrincipal;

    dump("SIMULATOR SCREEN INIT CALLED: " + nodePrincipal.origin + "\n");

    // fix orientation based on app manifest and
    // purge old app iframes (because a rapid kill-run sequence 
    // leave old iframes)
    let appOrigin = this._getOrigin(aWindow.location.href);
    this._fixAppIframe(appOrigin);

    aWindow = XPCNativeWrapper.unwrap(aWindow);

    dump("SCREEN ORIENTATION: " + globalScreen.mozOrientation + "\n");

    let chromeObject = {
      get top() 0,
      get left() 0,
      get availWidth() 0,
      get availHeight() 0,
      get availTop() 0,
      get availLeft() 0,
      get colorDepth() 24,
      get pixelDepth() 24,

      get width() globalScreen.width,
      get height() globalScreen.height,
      get mozOrientation() globalScreen.mozOrientation,

      _onmozorientationchange: null,
      get onmozorientationchange() this._onmozorientationchange,
      set onmozorientationchange(value) {
        if (this._onmozorientationchange) {
          aWindow.removeEventListener(this._onmozorientationchange);
        }
        this._onmozorientationchange = value;
        aWindow.addEventListener("mozorientationchange", value, true);

        return value;
      },
      addEventListener: aWindow.addEventListener,
      removeEventListener: aWindow.removeEventListener,

      mozLockOrientation: function(orientation) {
        if (nodePrincipal.appStatus == nodePrincipal.APP_STATUS_NOT_INSTALLED && 
            !aWindow.document.mozFullScreen) {
          // NOTE: refused lock because app is not installed and
          // it's not in fullscreen mode
          dump("DENY LOCKROTATION FROM NOT INSTALLED: " + nodePrincipal.origin + "\n");
          return false;
        }

        dump("REQUEST ORIENTATION LOCK: " + orientation + " from " + 
             appOrigin + "\n");
        let changed = orientation !== globalScreen.mozOrientation;

        if (orientation.match(/^portrait/)) {
          globalScreen.mozOrientation = orientation;
          globalScreen.lock();

          if (changed) {
            globalScreen.adjustWindowSize();
            let evt = aWindow.document.createEvent('CustomEvent');
            evt.initCustomEvent('mozorientationchange', true, false, {
              orientation: orientation
            });
            aWindow.dispatchEvent(evt);
          }

          return true;
        }
        if (orientation.match(/^landscape/)) {
          globalScreen.mozOrientation = orientation;
          globalScreen.lock();

          if (changed) {
            globalScreen.adjustWindowSize();
            let evt = aWindow.document.createEvent('CustomEvent');
            evt.initCustomEvent('mozorientationchange', true, false, {
              orientation: orientation
            });
            aWindow.dispatchEvent(evt);
          }

          return true;
        }
        dump("orientation not found: '" + orientation + "'\n");

        return true;
      },

      mozUnlockOrientation: function() {
        dump("REQUEST ORIENTATION UNLOCK: " + appOrigin + "\n");
        globalScreen.unlock();
        return true;
      },
      __exposedProps__: {
        top: "r",
        left: "r",
        width: "r",
        height: "r",
        colorDepth: "r",
        pixelDepth: "r",
        availWidth: "r",
        availHeight: "r",
        availLeft: "r",
        availTop: "r",
        mozOrientation: "r",
        onmozorientationchange: "rw",
        mozLockOrientation: "r",
        mozUnlockOrientation: "r",
        addEventListener: "r",
        removeEventListener: "r",
      }
    };

    return chromeObject;
  }
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([SimulatorScreen]);
