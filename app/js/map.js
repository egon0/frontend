'use strict';

angular.module('matemonkey.map',
               [
                 'ngRoute',
                 'matchMedia',
                 'leaflet-directive'
               ])
.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/map/dealer/:dealer_slug?', {
    templateUrl: 'templates/map/view.html',
    controller: 'MapController',
    reloadOnSearch: false
  });
}])

.controller('MapController', [
  '$scope', '$rootScope', '$http', '$routeParams', '$route', '$timeout', 'DealerService', 'MapService', 'screenSize', 'leafletData', 'leafletBoundsHelpers', 'urlfor',
  function($scope, $rootScope, $http, $routeParams, $route, $timeout, DealerService, MapService, screenSize, leafletData, leafletBoundsHelpers, urlfor) {

  $rootScope.title = "Map";
  $rootScope.pageDescription = "Look up the current stock and prices of mate drinks on MateMonkey.com";
  $scope.ready = false;
  $scope.requestInProgress = false;
  $scope.showSidebar = !screenSize.is('xs');
  $scope.center = {};
  $scope.bounds = {};

  var minZoom = 10;
  if (!screenSize.is('xs')) {
    minZoom = 5;
  }

  $scope.$on('DealerSelected', function(event, d) {
    $scope.showSidebar = true;
  });

  $scope.$on('MapFocus', function(event, location) {
    angular.extend($scope.center,
    {
      zoom: 12,
      lat: location.lat,
      lng: location.lon,
    });
    if (!screenSize.is('md, lg')) {
      $scope.showSidebar = false;
    }

  });

  $scope.$watch('showSidebar', function(val) {
    leafletData.getMap().then(function(map) {
      $timeout(function() {
        map.invalidateSize();
      }, 400);
    });
  });

  $scope.dealerToMarker = function(dealers) {
    return dealers.map(function(dealer) {
      return {
        layer: 'dealers',
        dealer: dealer,
        lat: dealer['address']['lat'],
        lng: dealer['address']['lon'],
        icon: $scope.icons[dealer.type]
      };
    });
  };

  $scope.focusOnDealer = function(dealer) {
    angular.extend($scope.center,
                    {
                      zoom: 18,
                      lat: dealer.address.lat,
                      lng: dealer.address.lon,
                    });
  }

  $scope.loadDealers = function(force) {
    var requestBounds = angular.copy($scope.bounds);
    if (requestBounds === undefined || Object.keys(requestBounds).length === 0) {
      return;
    }
    if ($scope.requestInProgress ==  true) {
      return;
    }

    requestBounds.northEast.lat = Math.min(Math.max(requestBounds.northEast.lat,  -90), 90);
    requestBounds.southWest.lat = Math.min(Math.max(requestBounds.southWest.lat,  -90), 90);
    requestBounds.northEast.lng = Math.min(Math.max(requestBounds.northEast.lng, -180), 180)
    requestBounds.southWest.lng = Math.min(Math.max(requestBounds.southWest.lng, -180), 180)

    if ($scope.requestedBounds !== undefined && force == false) {
      if ($scope.utils.compareBounds(requestBounds, $scope.requestedBounds) == false) {
        return;
      }
    }

    requestBounds = $scope.utils.scaleBounds(requestBounds, Math.ceil($scope.center.zoom/4));

    $scope.markers = {};
    $scope.requestInProgress = true;
    $scope.requestedBounds = requestBounds;
    $http({
        url: urlfor.get("dealers"),
        method: "GET",
        params: {bbox: requestBounds.southWest.lat + "," +
                       requestBounds.southWest.lng + "," +
                       requestBounds.northEast.lat + "," +
                       requestBounds.northEast.lng,
                type: $scope.types,
                product: $scope.products}
      }).success(function(data) {
        $scope.markers = $scope.dealerToMarker(data['dealers']);
        $scope.requestInProgress = false;
      }).error(function(data) {
        $scope.requestInProgress = false;
      });
  };
  angular.extend($scope, {
    icons: {
      retail : {
        type: 'awesomeMarker',
        icon: 'shopping-cart',
        markerColor: 'green'
      },
      restaurant: {
        type: 'awesomeMarker',
        icon: 'cutlery',
        markerColor: 'orange'
      },
      bar: {
        type: 'awesomeMarker',
        icon: 'glass',
        markerColor: 'red'
      },
      club: {
        type: 'awesomeMarker',
        icon: 'cd',
        markerColor: 'purple'
      },
      community: {
        type: 'awesomeMarker',
        icon: 'user',
        markerColor: 'cadetblue'
      },
      hackerspace: {
        type: 'awesomeMarker',
        icon: 'glyphicon icon-glider',
        markerColor: 'blue'
      },
      other: {
        type: 'awesomeMarker',
        icon: 'info-sign',
        markerColor: 'darkgreen'
      }
    },
    layers: {
      baselayers: {
        osm: {
          name: 'OSM',
          type: 'xyz',
          url: 'https://otile{s}-s.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.jpg',
          layerParams: {
            noWrap: true,
            subdomains: '1234',
            attribution: "© <a href=\"http://www.openstreetmap.org/copyright\" target=\"_blank\">OpenStreetMap</a> contributors | Tiles Courtesy of <a href=\"http://www.mapquest.com/\" target=\"_blank\">MapQuest</a> <img src=\"https://developer.mapquest.com/content/osm/mq_logo.png\">",
            prefix: false
          }
        }
      },
      overlays: {
        dealers: {
          name: 'dealers',
          type: 'markercluster',
          visible: true,
          layerOptions: {
            showCoverageOnHover: false,
            disableClusteringAtZoom: 14
          }
        }
      }
    },
    defaults: {
      zoomControlPosition: 'topright',
      controls: {
        layers: {
          visible: false,
        }
      },
      minZoom: minZoom,
      center: {
        lat: 0,
        lng: 0,
        autoDiscover: false
      }
    }
  });


  $scope.focusOnLocation = function() {
    if ($routeParams.hasOwnProperty('@')) {
      var atRegex = /(\d{1,2}),(-?\d+\.\d+),(-?\d+\.\d+)/;
      var result = $routeParams['@'].match(atRegex);
      if (result != null) {
        var zoom = parseInt(result[1]);
        var lat = parseFloat(result[2]);
        var lon = parseFloat(result[3]);
        angular.extend($scope.center,
        {
          zoom: zoom,
          lat: lat,
          lng: lon,
        });
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  if ($routeParams.hasOwnProperty('dealer_slug')) {
    $http({
      url: urlfor.get("dealersSlug", $routeParams.dealer_slug),
      method: "GET"
    }).success(function(dealer) {
      DealerService.select(dealer);
      if (!$scope.focusOnLocation()) {
        $scope.focusOnDealer(dealer);
      }
      $scope.ready = true;
    }).error(function() {
      if (!$scope.focusOnLocation()) {
        angular.extend($scope, {
          center: {
            zoom: 12,
            lat: 48.13722,
            lng: 11.575556,
            autoDiscover: true
          }
        });
      }
      $scope.ready = true;
    });
  } else {
    if (!$scope.focusOnLocation()) {
      angular.extend($scope, {
        center: {
          zoom: 12,
          lat: 48.13722,
          lng: 11.575556,
          autoDiscover: true
        }
      });
    }
    $scope.ready = true;
  }

    $scope.$on('leafletDirectiveMarker.click', function (e, args) {
    DealerService.select(args['model'].dealer);
  });

  $scope.$on('FilterChanged',function(event, f) {
    var pCount = 0;
    $scope.products = "";
    angular.forEach(f.product, function(value, key) {
      if (value == true) {
        pCount += 1;
        if ($scope.products.length == 0) {
          $scope.products = key;
        } else {
          $scope.products += "," + key;
        }
      }
    });
    if (pCount == 0) {
      $scope.products = null;
    }

    if (f.type.all == true) {
      $scope.types = null
    } else {
      $scope.types = ""
      angular.forEach(f.type, function(value, key) {
        if (value == true) {
          if ($scope.types.length == 0) {
            $scope.types = key;
          } else {
            $scope.types += "," + key;
          }
        }
      });
    }
    if ($scope.ready == true) {
      $scope.loadDealers(true);
    }
  });

  $scope.$on('DealerCreated', function(event, d) {
    $scope.loadDealers(true);
    $scope.focusOnDealer(d);
  });

  $scope.$on('DealerUpdated', function(event, d) {
    /* Doesn't work at the moment
    for (var i = 0; i < $scope.markers.length; i++) {
      if ($scope.markers[i].dealer.id == d.id) {
        $scope.markers.splice(i, 1, $scope.dealerToMarker([d])[0]);
        console.log("Updated");
        break;
      }
    }
    */
    $scope.loadDealers(true);
  });
  $scope.$watch('bounds', function(newVal, oldVal) {
    $route.updateParams({'@': $scope.center.zoom + ','
                          + $scope.center.lat.toFixed(6) + ','
                          + $scope.center.lng.toFixed(6)});
    if ($scope.ready == true) {
      $scope.loadDealers(false);
    }
  });
}])
.service('MapService', ['$rootScope', function($rootScope) {
  return {
    focus: function(location) {
      $rootScope.$broadcast('MapFocus', location);
    }
  }
}]);

