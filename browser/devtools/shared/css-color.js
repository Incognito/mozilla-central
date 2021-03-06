/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const COLOR_UNIT_PREF = "devtools.defaultColorUnit";
const {Cc, Ci, Cu} = require("chrome");
let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

/**
 * This module is used to convert between various color types.
 *
 * Usage:
 *   let {devtools} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
 *   let {colorUtils} = devtools.require("devtools/shared/css-color");
 *
 *   color.authored === "red"
 *   color.hasAlpha === false
 *   color.valid === true
 *   color.transparent === false // transparent has a special status.
 *   color.name === "red"        // returns hex or rgba when no name available.
 *   color.hex === "#F00"        // returns shortHex when available else returns
 *                                  longHex. If alpha channel is present then we
 *                                  return this.rgba.
 *   color.longHex === "#FF0000" // If alpha channel is present then we return
 *                                  this.rgba.
 *   color.rgb === "rgb(255, 0, 0)" // If alpha channel is present then we return
 *                                     this.rgba.
 *   color.rgba === "rgba(255, 0, 0, 1)"
 *   color.hsl === "hsl(0, 100%, 50%)"
 *   color.hsla === "hsla(0, 100%, 50%, 1)" // If alpha channel is present
 *                                             then we return this.rgba.
 *
 *   color.toString() === "#F00"; // Outputs the color type determined in the
 *                                   COLOR_UNIT_PREF constant (above).
 *   // Color objects can be reused
 *   color.newColor("green") === "#0F0"; // true
 *
 *   let processed = colorUtils.processCSSString("color:red; background-color:green;");
 *   // Returns "color:#F00; background-color:#0F0;"
 *
 *   Valid values for COLOR_UNIT_PREF are contained in CssColor.COLORUNIT.
 */

function CssColor(colorValue) {
  this.newColor(colorValue);
}

module.exports.colorUtils = {
  CssColor: CssColor,
  processCSSString: processCSSString
};

/**
 * Values used in COLOR_UNIT_PREF
 */
CssColor.COLORUNIT = {
  "authored": "authored",
  "hex": "hex",
  "name": "name",
  "rgb": "rgb",
  "hsl": "hsl"
};

CssColor.prototype = {
  authored: null,

  get hasAlpha() {
    if (!this.valid || this.transparent) {
      return false;
    }
    return this._getRGBATuple().a !== 1;
  },

  get valid() {
    return this._validateColor(this.authored);
  },

  get transparent() {
    try {
      let tuple = this._getRGBATuple();
      return tuple === "transparent";
    } catch(e) {
      return false;
    }
  },

  get name() {
    if (!this.valid) {
      return "";
    }
    if (this.authored === "transparent") {
      return "transparent";
    }
    try {
      let tuple = this._getRGBATuple();

      if (tuple === "transparent") {
        return "transparent";
      }
      if (tuple.a !== 1) {
        return this.rgb;
      }
      let {r, g, b} = tuple;
      return DOMUtils.rgbToColorName(r, g, b);
    } catch(e) {
      return this.hex;
    }
  },

  get hex() {
    if (!this.valid) {
      return "";
    }
    if (this.hasAlpha) {
      return this.rgba;
    }
    if (this.transparent) {
      return "transparent";
    }

    let hex = this.longHex;
    if (hex.charAt(1) == hex.charAt(2) &&
        hex.charAt(3) == hex.charAt(4) &&
        hex.charAt(5) == hex.charAt(6)) {
      hex = "#" + hex.charAt(1) + hex.charAt(3) + hex.charAt(5);
    }
    return hex;
  },

  get longHex() {
    if (!this.valid) {
      return "";
    }
    if (this.hasAlpha) {
      return this.rgba;
    }
    if (this.transparent) {
      return "transparent";
    }
    return this.rgb.replace(/\brgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)/gi, function(_, r, g, b) {
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + (b << 0)).toString(16).substr(-6).toUpperCase();
    });
  },

  get rgb() {
    if (!this.valid) {
      return "";
    }
    if (this.transparent) {
      return "transparent";
    }
    if (!this.hasAlpha) {
      let tuple = this._getRGBATuple();
      return "rgb(" + tuple.r + ", " + tuple.g + ", " + tuple.b + ")";
    }
    return this.rgba;
  },

  get rgba() {
    if (!this.valid) {
      return "";
    }
    if (this.transparent) {
      return "transparent";
    }
    let components = this._getRGBATuple();
    return "rgba(" + components.r + ", " +
                     components.g + ", " +
                     components.b + ", " +
                     components.a + ")";
  },

  get hsl() {
    if (!this.valid) {
      return "";
    }
    if (this.transparent) {
      return "transparent";
    }
    if (this.hasAlpha) {
      return this.hsla;
    }
    return this._hslNoAlpha();
  },

  get hsla() {
    if (!this.valid) {
      return "";
    }
    if (this.transparent) {
      return "transparent";
    }
    // Because an hsla rbg roundtrip would lose accuracy we use the authored
    // values if this is an hsla color.
    if (this.authored.startsWith("hsla(")) {
      let [, h, s, l, a] = /^\bhsla\(([\d.]+),\s*([\d.]+%),\s*([\d.]+%),\s*([\d.]+|0|1)\)$/gi.exec(this.authored);
      return "hsla(" + h + ", " + s + ", " + l + ", " + a + ")";
    }
    if (this.hasAlpha) {
      let a = this._getRGBATuple().a;
      return this._hslNoAlpha().replace("hsl", "hsla").replace(")", ", " + a + ")");
    }
    return this._hslNoAlpha().replace("hsl", "hsla").replace(")", ", 1)");
  },

  /**
   * Change color
   *
   * @param  {String} color
   *         Any valid color string
   */
  newColor: function(color) {
    this.authored = color.toLowerCase();
    return this;
  },

  /**
   * Return a string representing a color of type defined in COLOR_UNIT_PREF.
   */
  toString: function() {
    let color;
    let defaultUnit = Services.prefs.getCharPref(COLOR_UNIT_PREF);
    let unit = CssColor.COLORUNIT[defaultUnit];

    switch(unit) {
      case CssColor.COLORUNIT.authored:
        color = this.authored;
        break;
      case CssColor.COLORUNIT.hex:
        color = this.hex;
        break;
      case CssColor.COLORUNIT.hsl:
        color = this.hsl;
        break;
      case CssColor.COLORUNIT.name:
        color = this.name;
        break;
      case CssColor.COLORUNIT.rgb:
        color = this.rgb;
        break;
      default:
        color = this.rgb;
    }
    return color;
  },

  /**
   * Returns a RGBA 4-Tuple representation of a color or transparent as
   * appropriate.
   */
  _getRGBATuple: function() {
    let win = Services.appShell.hiddenDOMWindow;
    let doc = win.document;
    let span = doc.createElement("span");
    span.style.color = this.authored;
    let computed = win.getComputedStyle(span).color;

    if (computed === "transparent") {
      return "transparent";
    }

    let rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*(\d+\.\d+|1|0)\)$/gi.exec(computed);

    if (rgba) {
      let [, r, g, b, a] = rgba;
      return {r: r, g: g, b: b, a: a};
    } else {
      let rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/gi.exec(computed);
      let [, r, g, b] = rgb;

      return {r: r, g: g, b: b, a: 1};
    }
  },

  _hslNoAlpha: function() {
    let {r, g, b} = this._getRGBATuple();

    // Because an hsl rbg roundtrip would lose accuracy we use the authored
    // values if this is an hsla color.
    if (this.authored.startsWith("hsl(")) {
      let [, h, s, l] = /^\bhsl\(([\d.]+),\s*([\d.]+%),\s*([\d.]+%)\)$/gi.exec(this.authored);
      return "hsl(" + h + ", " + s + ", " + l + ")";
    }

    r = r / 255;
    g = g / 255;
    b = b / 255;

    let max = Math.max(r, g, b);
    let min = Math.min(r, g, b);
    let h;
    let s;
    let l = (max + min) / 2;

    if(max == min){
      h = s = 0;
    } else {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch(max) {
          case r:
            h = ((g - b) / d) % 6;
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          case b:
            h = (r - g) / d + 4;
            break;
      }
      h *= 60;
      if (h < 0) {
        h += 360;
      }
    }
    return "hsl(" + (Math.round(h * 1000)) / 1000 +
           ", " + Math.round(s * 100) +
           "%, " + Math.round(l * 100) + "%)";
  },

  /**
   * This method allows comparison of CssColor objects using ===.
   */
  valueOf: function() {
    return this.rgba;
  },

  _validateColor: function(color) {
    if (typeof color !== "string" || color === "") {
      return false;
    }

    let win = Services.appShell.hiddenDOMWindow;
    let doc = win.document;

    // Create a black span in a hidden window.
    let span = doc.createElement("span");
    span.style.color = "rgb(0, 0, 0)";

    // Attempt to set the color. If the color is no longer black we know that
    // color is valid.
    span.style.color = color;
    if (span.style.color !== "rgb(0, 0, 0)") {
      return true;
    }

    // If the color is black then the above check will have failed. We change
    // the span to white and attempt to reapply the color. If the span is not
    // white then we know that the color is valid otherwise we return invalid.
    span.style.color = "rgb(255, 255, 255)";
    span.style.color = color;
    return span.style.color !== "rgb(255, 255, 255)";
  },
};

/**
 * Process a CSS string
 *
 * @param  {String} value
 *         CSS string e.g. "color:red; background-color:green;"
 * @return {String}
 *         Converted CSS String e.g. "color:#F00; background-color:#0F0;"
 */
function processCSSString(value) {
  if (value && /^""$/.test(value)) {
    return value;
  }

  // This regex matches:
  //  - #F00
  //  - #FF0000
  //  - hsl()
  //  - hsla()
  //  - rgb()
  //  - rgba()
  //  - red
  //
  //  It also matches css keywords e.g. "background-color" otherwise
  //  "background" would be replaced with #6363CE ("background" is a platform
  //  color).
  let colorPattern = /#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b|hsl\(.*?\)|hsla\(.*?\)|rgba?\(.*?\)|\b[a-zA-Z-]+\b/g;

  value = value.replace(colorPattern, function(match) {
    let color = new CssColor(match);
    if (color.valid) {
      return color;
    }
    return match;
  });
  return value;
}

loader.lazyGetter(this, "DOMUtils", function () {
  return Cc["@mozilla.org/inspector/dom-utils;1"].getService(Ci.inIDOMUtils);
});
