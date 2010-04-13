/*
 Copyright 2010 Redfin Corporation
 Licensed under the Apache License, Version 2.0: 
 http://www.apache.org/licenses/LICENSE-2.0 
 */

com = {redfin: {}};

/* Construct a new FastMarkerOverlay layer for a V2 map
 * @constructor
 * @param {Array.<com.redfin.FastMarker>} markers the array of markers to display on the map
 */
com.redfin.FastMarkerOverlay = function(markers) {
  this._markers = markers;
}

/* Called by the map when you add it via GMap2.addOverlay()
 * @param {GMap2} map the map to which we'll add markers
 */
com.redfin.FastMarkerOverlay.prototype.initialize = function(map) {
  this._map = map;
  
  this._div = document.createElement("div");
  this._map.getPane(G_MAP_MARKER_PANE).appendChild(this._div);
};

/* Copy our data to a new FastMarkerOverlay
 * @return {FastMarkerOverlay} Copy of FastMarkerOverlay
 */
com.redfin.FastMarkerOverlay.prototype.copy = function() {
  var markers = this._markers;
  var i = markers.length;
  var markersCopy = new Array(i);
  while (i--) {
    markersCopy[i] = markers[i].copy();
  }
  return new com.redfin.FastMarkerOverlay(markers);
};

/* Redraw the FastMarkerOverlay based on the current projection and zoom level; called by Gmaps
 * @param {boolean} force Helps decide whether to redraw overlay
 */
com.redfin.FastMarkerOverlay.prototype.redraw = function(force) {
  // We only need to redraw if the coordinate system has changed
  if (!force) return;

  // if already removed, never redraw
  if (!this._div) return;

  // DGF use fastloop http://ajaxian.com/archives/fast-loops-in-js
  // JD Create string with all the markers
  var i = this._markers.length;
  var textArray = [];
  while (i--) {
    var marker = this._markers[i];
    var divPixel = this._map.fromLatLngToDivPixel(marker._latLng);
    textArray.push("<div style='position:absolute; left:");
    textArray.push(divPixel.x + marker._leftOffset);
    textArray.push("px; top:");
    textArray.push(divPixel.y + marker._topOffset);
    textArray.push("px;")
    if (marker._zIndex) {
      textArray.push(" z-index:");
      textArray.push(marker._zIndex);
      textArray.push(";");
    }
    textArray.push("'");
    if (marker._divClassName) {
      textArray.push(" class='");
      textArray.push(marker._divClassName);
      textArray.push("'");
    }
    textArray.push(" id='");
    textArray.push(marker._id);
    textArray.push("' >");

    var markerHtmlArray = marker._htmlTextArray;
    var j = markerHtmlArray.length;
    var currentSize = textArray.length;
    while (j--) {
      textArray[j + currentSize] = markerHtmlArray[j];
    }
    textArray.push("</div>");
  }
  
  //Insert the HTML into the overlay
  this._div.innerHTML = textArray.join('');
}

/** Hide all of the markers */
com.redfin.FastMarkerOverlay.prototype.hide = function() {
  if (!this._div) return;
  this._div.style.display = "none";
}

/** Show all of the markers after hiding them */
com.redfin.FastMarkerOverlay.prototype.unhide = function() {
  if (!this._div) return;
  this._div.style.display = "block";
}

/** Remove the overlay from the map; never use the overlay again after calling this function */
com.redfin.FastMarkerOverlay.prototype.remove = function() {
  this._map.getPane(G_MAP_MARKER_PANE).removeChild(this._div);
  this._div = null;
}


/** Create a single marker for use in FastMarkerOverlay
 * @constructor
 * @param {string} id DOM node ID of the div that will contain the marker
 * @param {GLatLng} latLng geographical location of the marker 
 * @param {Array.<string>} htmlTextArray an array of strings which we'll join together to form the HTML of your marker
 * @param {string=} divClassName the CSS class of the div that will contain the marker. (optional)
 * @param {string=} zIndex zIndex of the div that will contain the marker. (optional, 'auto' by default)
 * @param {number=} leftOffset the offset in pixels by which we'll horizontally adjust the marker position (optional)
 * @param {number=} topOffset the offset in pixels by which we'll vertically adjust the marker position (optional)
*/
com.redfin.FastMarker = function(id, latLng, htmlTextArray, divClassName, zIndex, leftOffset, topOffset) {
  this._id = id;
  this._latLng = latLng;
  this._htmlTextArray = htmlTextArray;
  this._divClassName = divClassName;
  this._zIndex = zIndex;
  this._leftOffset = leftOffset || 0;
  this._topOffset = topOffset || 0;
}

/** Copy the FastMarker
 * @return {com.redfin.FastMarker} duplicate of this marker
 */
com.redfin.FastMarker.prototype.copy = function() {
  var htmlArray = this._htmlTextArray;
  var i = htmlArray.length;
  var htmlArrayCopy = new Array(i);
  while (i--) {
    htmlArrayCopy[i] = htmlArray[i];
  }
  return new com.redfin.FastMarker(this._id, latLng, htmlArrayCopy, this._divClassName, this._zIndex, this._leftOffset, this._topOffset);
}