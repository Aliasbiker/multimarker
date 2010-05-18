/*
  Copyright 2010 Redfin Corporation
  Licensed under the Apache License, Version 2.0:
  http://www.apache.org/licenses/LICENSE-2.0
  */
if (!this.com) com = {redfin: {}};

/* Construct a new Cluster from two nodes (either FastMarkers or another clusters)
  * @constructor
  * @param {string} id the unique identifier for this cluster
  * @param {com.redfin.Cluster|com.redfin.FastMarker} from one node in the cluster
  * @param {com.redfin.Cluster|com.redfin.FastMarker} to the other node in the cluster
  */
com.redfin.Cluster = function(id, from, to) {
    if (!from) throw new Error("from is null");
    if (!to) throw new Error("to is null");
    this._id = id;
    this.isCluster = true;
    this.nodes = [from, to];

    this._count = 0;
    this._count += from.isCluster ? from._count : 1;
    this._count += to.isCluster ? to._count : 1;

    var i = this.nodes.length;
    var latTotal =0, lngTotal = 0;
    while (i--) {
        var node = this.nodes[i];
        var latLng = node._latLng;
        if (node.isCluster) {
            latTotal += node._count * latLng.lat();
            lngTotal += node._count * latLng.lng();
        } else {
            latTotal += latLng.lat();
            lngTotal += latLng.lng();
        }
    }
    var lat = latTotal / this._count
    var lng = lngTotal / this._count;
    // TODO which node?
    if (isNaN(lat)) throw new Error("latitude is NaN");
    if (isNaN(lng)) throw new Error("longitude is NaN");
    this._latLng = new google.maps.LatLng(lat, lng);
}

/* The number of nodes in this cluster
  * @return {number} the number of nodes in this cluster
  */
com.redfin.Cluster.prototype.count = function count() {
  return this._count;
}

/* The bounding box of all nodes in this cluster
  * @return {google.maps.LatLngBounds} The bounding box of all nodes in this cluster
  */
com.redfin.Cluster.prototype.region = function region() {
    function regionForNode(node) {
        if (node.isCluster) {
            return node.region();
        } else {
            return new google.maps.LatLngBounds(node._latLng);
        }
    }
    var i = this.nodes.length-1;
    var region = regionForNode(this.nodes[0]);
    var region2 = regionForNode(this.nodes[1]);
    region.union(region2);
    return region;
}

/** Asynchronously generate a sorted list of clusters from a list of markers.
  * The list is sorted by the size of the cluster bounding boxes.  We can use 
  * this list to display a mix of clusters and markers: if a cluster's 
  * bounding box is less than some minimum size X, then we show the cluster;
  * otherwise, we just show the cluster's individual markers.
  * @param {Array.<com.redfin.FastMarker>} markers the array of markers to display on the map
  * @param {???} finishedCallback we'll call this function when we're done calculating markers
  * @param {???} progressCallback we'll call this function periodically with a number from 1-100, to indicate progress
  */
com.redfin.Cluster.sortedClusterListFromMarkerCollection = function(markers, finishedCallback, progressCallback) {
  nodes = [];
  nodesToDisplay = {};

  var i = markers.length;
  while (i--) {
    nodes[i] = markers[i];
  }
  
  var count = nodes.length;

  var minimumDistances = new Array(count);
  var minimumDistancePartners = new Array(count);
  var i = count;

  while (i--) {
      minimumDistances[i] = Number.POSITIVE_INFINITY;
  }

  // for each point, find the point nearest to it (its "minimumDistancePartner") and the distance between partners
  for (i = 0; i < count; i++) {
      for (j = i+1; j < count; j++) {
          var from = nodes[i];
          var to = nodes[j];
          var dist = coordinateDistance(from, to);
          updateClusterMinDistanceData(dist, minimumDistances, minimumDistancePartners, i, j);
      }
  }
  
  progressCallback = progressCallback || function() {};

  progressCallback(10);
  var clusterList = [];
  
  i = count - 1;
  function makeClusters() {
    while (i--) {
        // find the two nodes with the smallest distance
        var shortestDistanceFrom, shortestDistanceTo;
        var shortestDistance = Number.POSITIVE_INFINITY;
        j = count;
        while (j--) {
            if (nodes[j]) {
                var maybeMinimum = minimumDistances[j];
                if (maybeMinimum < shortestDistance) {
                    shortestDistance = maybeMinimum;
                    shortestDistanceFrom = j;
                    shortestDistanceTo = minimumDistancePartners[j];
                }
            }
        }
        // make a cluster out of these two nodes
        var cluster = new com.redfin.Cluster("cluster"+i, nodes[shortestDistanceFrom], nodes[shortestDistanceTo]);
        clusterList.push(cluster);
        if (!i) {
          progressCallback(100);
          finishedCallback(clusterList);
        }
        // replace one partner with the cluster; delete the other partner
        nodes[shortestDistanceFrom] = cluster;
        nodes[shortestDistanceTo] = null;
      
        // now recalculate the distances of the new cluster from the old stuff -sra.
        // initialize the cluster's partner (we'll replace this data in a moment)
        minimumDistances[shortestDistanceFrom] = Number.POSITIVE_INFINITY;
        minimumDistancePartners[shortestDistanceFrom] = null;
      
        j = count;
        while (j--) {
            if (nodes[j]) {
                // "shortestDistanceFrom" is the index of the cluster
                // don't allow the cluster to be closest to itself!
                if (j != shortestDistanceFrom) {
                    var dist = coordinateDistance(cluster, nodes[j]);
                    updateClusterMinDistanceData(dist, minimumDistances, minimumDistancePartners, j, shortestDistanceFrom);
                }
            } else {
                minimumDistances[j] = Number.POSITIVE_INFINITY;
                minimumDistancePartners[j] = null;
            }
        }

        //NSS - now check to see if anyone had shortestDistanceTo or shortestDistanceFrom as their minimumDistancePartner
        j = count;
        while (j--) {
            if (nodes[j]) {
                var minimumDistancePartner = minimumDistancePartners[j];
                if (minimumDistancePartner == shortestDistanceFrom || minimumDistancePartner == shortestDistanceTo) {
                    //NSS - find a new minimum distance and partner
                    minimumDistances[j] = Number.POSITIVE_INFINITY;
                    k = count;
                    while (k--) {
                        if (nodes[k] && j!=k) {
                            dist = coordinateDistance(nodes[j], nodes[k]);
                            updateClusterMinDistanceData(dist, minimumDistances, minimumDistancePartners, j, k);
                        }
                    }
                }
            }
        }
    
        var iterationsCompleted = count - i;
        progress = 10 + 90 * iterationsCompleted / count;
        progressCallback(progress);
        if (false) {
          setTimeout(makeClusters, 0);
          return;
        }
    }
  }
  makeClusters();

  function coordinateDistance(from, to) {
      // cartesian distance
      from = from._latLng;
      to = to._latLng;
      var latSpan = from.lat() - to.lat();
      var lngSpan = from.lng() - to.lng();
      return Math.sqrt( (latSpan * latSpan) + (lngSpan * lngSpan) );
  }

  function updateClusterMinDistanceData(dist, minimumDistances, minimumDistancePartners, i, j) {
  	if (dist < minimumDistances[i]) {
  		minimumDistances[i] = dist;
  		minimumDistancePartners[i] = j;
  	}
  	if (dist < minimumDistances[j]) {
  		minimumDistances[j] = dist;
  		minimumDistancePartners[j] = i;
  	}
  }
}

/** Construct a new ClusterOverlay for a V3 map
  * @constructor
  * @param {google.maps.Map} map the map to which we'll add markers
  * @param {Array.<com.redfin.Cluster>} clusterList list of clusters sorted by bounding box area from smallest to largest. Use com.redfin.Cluster.sortedClusterListFromMarkerCollection to construct this list.
  * @param {number} clusterSeparationInPixels the minimum distance allowed between two markers before we'll cluster them
  * @param {???} clusterToMarkerFunction we'll pass a cluster to this function; you'll turn it into a com.redfin.FastMarker suitable for adding to the map.
  */
com.redfin.ClusterOverlay = function(map, clusterList, markers, clusterSeparationInPixels, clusterToMarkerFunction) {
    this.map = map;
    this.clusterList = clusterList;
    this.markers = markers;
    this.clusterSeparationInPixels = clusterSeparationInPixels;
    this.clusterToMarkerFunction = clusterToMarkerFunction;
    this.setMap(map);
}

com.redfin.ClusterOverlay.prototype = new com.redfin.FastMarkerOverlay();

/* Draw the overlay based on the current projection and zoom level; called by Google Maps */
com.redfin.ClusterOverlay.prototype.draw = function() {
    // We need a projection to convert from LatLng to pixels
    var overlayProjection = this.getProjection();
    
    this.markersToDisplay = {};
    var i = this.markers.length;
    // Display everything at first; we'll remove markers that belong to a given cluster
    while (i--) {
      var marker = this.markers[i];
      this.markersToDisplay[marker._id] = marker;
    }
    
    count = this.clusterList.length;
    for (i = 0; i < count; i++) {
        var cluster = this.clusterList[i];
        var region = cluster.region();
        var swPixel = overlayProjection.fromLatLngToDivPixel(region.getSouthWest());
        var nePixel = overlayProjection.fromLatLngToDivPixel(region.getNorthEast());
        var xSpan = nePixel.x - swPixel.x;
        var ySpan = nePixel.y - swPixel.y;
        var distance = Math.sqrt( xSpan*xSpan + ySpan*ySpan );
        if (distance > this.clusterSeparationInPixels) break;
        
        // don't display any of this cluster's nodes...
        j = cluster.nodes.length;
        while (j--) {
            var node = cluster.nodes[j];
            if (node._id) {
                delete this.markersToDisplay[node._id];
            }
        }
        
        // ... display the cluster marker instead.
        this.markersToDisplay[cluster._id] = this.clusterToMarkerFunction(cluster);
    }
    
    // Now allow FastMarkerOverlay to display the unclustered markers and the cluster markers
    this._markers = [];
    for (var id in this.markersToDisplay) {
      this._markers.push(this.markersToDisplay[id]);
    }
    com.redfin.FastMarkerOverlay.prototype.draw.call(this);
}
