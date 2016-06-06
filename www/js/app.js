// TwinWallet Rebuild App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
angular.module('starter', ['ionic', 'ngMessages', 'bwcModule', 'bwrModule'])

.run(function($ionicPlatform) {
  $ionicPlatform.ready(function() {
    if(window.cordova && window.cordova.plugins.Keyboard) {
      // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
      // for form inputs)
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);

      // Don't remove this line unless you know what you are doing. It stops the viewport
      // from snapping when text inputs are focused. Ionic handles this internally for
      // a much nicer keyboard experience.
      cordova.plugins.Keyboard.disableScroll(true);
    }
    if(window.StatusBar) {
      StatusBar.styleDefault();
    }
  });
})


.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider
        .state('main', {
          url: '/main',
          templateUrl: 'templates/main.html',
          controller: 'mainController'
        })
        .state('success', {
          url: '/success',
          templateUrl: 'templates/success.html'
        })
        .state('xprivkey', {
          url: '/xprivkey/:xPrivKey',
          templateUrl: 'templates/xprivkey.html',
          controller: 'xprivController'
        })
        .state('xprivkey.keyloaded', {
          url: "/keyloaded/:xPrivKey",
          views: {
            'container' :{
              templateUrl: "templates/keyloaded.html"
            }
          }
        })
        .state('xprivkey.loading', {
          url: "/loading/:xPrivKey",
          views: {
            'container' :{
              templateUrl: "templates/loading.html"
            }
          }
        });
    $urlRouterProvider.otherwise('/main');
})

.controller('xprivController', function($scope, $state, $stateParams, $q, $ionicPopup, $ionicLoading, bwrService) {
  $scope.xPrivKey = $stateParams.xPrivKey;

	$scope.show = function(template) {
		$ionicLoading.show({
			template: template,
			delay: 0
		});
	};

	$scope.hide = function(){
        $ionicLoading.hide();
	};

  setTimeout(function() {
    $q.all([bwrService.getBalance(), bwrService.getTxHistory()]).then(function(result) {
      $scope.balance = result[0];
      $scope.transactions = result[1];
            
      for (var i = 0; i < $scope.transactions.length; i++) {
        var date = new Date($scope.transactions[i].time*1000);
          $scope.transactions[i].time = date.toLocaleDateString();
      }
      
      bwrService.getMaxFees().then(function(fees) {
        $scope.maxFees = fees;
        $state.go('xprivkey.keyloaded', {'xPrivKey' : $stateParams.xPrivKey});
      }, function(err) {
				$ionicPopup.alert({
					title: 'Errore nel recuper del wallet',
					template: 'Risposta del server: ' + htmlspecialchars(err.toString())
				});
      })

    }, function(err) {
			$ionicPopup.alert({
				title: 'Errore nel trasfermento del wallet',
				template: 'Risposta del server: ' + htmlspecialchars(err.toString())
			});
    });
  }, 0);

  $scope.moveWallet = function(form) {
		
		if (!form.$valid) return; 
		
		$scope.show('<p>Moving satoshis...</p><ion-spinner></ion-spinner>'); // Shows the $ionicLoading spinner

    setTimeout(function() {
  		bwrService.move(form.target.title, form.amount.title).then(function(result) { // Resolve
        $state.go('success');
  		}, function(reason) { // Reject
  			$ionicPopup.alert({
  				title: 'Errore nel trasfermento del wallet',
  				template: 'Risposta del server: ' + htmlspecialchars(reason.toString())
  			});
  		}).finally(function(){
  			$scope.hide()
  		});
    }, 0);
  };
})

.controller('mainController', function($scope, $state, $ionicLoading, $ionicPopup, bwrService) {
	$scope.show = function(template) {
		$ionicLoading.show({
			template: template,
			delay: 0
		});
	};

	$scope.hide = function(){
        $ionicLoading.hide();
	};

	$scope.recoverKey = function(dataForm) {
		
		if (!dataForm.$valid) return; 
		
		$scope.show('<p>Retrieving wallet info...</p><ion-spinner></ion-spinner>'); // Shows the $ionicLoading spinner
		
		setTimeout(function() {
      
      // BaseUrl
      bwrService.setBaseUrl(dataForm.bwsUrl.title);
      
			var key = bwrService.getKey(dataForm.secret1.title, dataForm.secret2.title)
			
			key.then(function(keyValue) { // Resolve
        $state.go('xprivkey.loading', {'xPrivKey' : keyValue});
			}, function (reason) { // Reject
				$ionicPopup.alert({
					title: 'Errore nella creazione/recupero del wallet',
					template: 'Risposta del server: ' + htmlspecialchars(reason.toString())
				});
			}).finally(function() {
				$scope.hide();
			});
		}, 100); // ??? Senza questo ritardo lo spinner appare in ritardo ???
	}

})

.directive('secret', function() {
	return {

		// limit usage to argument only
		restrict: 'A',
		
		// require NgModelController, i.e. require a controller of ngModel directive
		require: 'ngModel',
		
		// create linking function and pass in our NgModelController as a 4th argument
		link: function(scope, element, attr, ctrl) {
		  
			function customValidator(ngModelValue) {
		
				// check if it's a twelve words phrase
				// if it is, set our custom `twelveWordsValidator` to valid/true
				// otherwise set it to non-valid/false
				if (/^([A-Za-z]+\s){11}[A-Za-z]+$/.test(ngModelValue)) {
					ctrl.$setValidity('twelveWordsValidator', true);
				} else {
					ctrl.$setValidity('twelveWordsValidator', false);
				}

				// we need to return our ngModelValue, to be displayed to the user(value of the input)
				return ngModelValue;
		  }

			// we need to add our customValidator function to an array of other(build-in or custom) functions
			// I have not notice any performance issues, but it would be worth investigating how much
			// effect does this have on the performance of the app
			ctrl.$parsers.push(customValidator);
			
		}
	}
})

.directive('bcAddress', ['bwcService', function(bwcService) {
	return {

	  // limit usage to argument only
	  restrict: 'A',

	  // require NgModelController, i.e. require a controller of ngModel directive
	  require: 'ngModel',

	  // create linking function and pass in our NgModelController as a 4th argument
	  link: function(scope, element, attr, ctrl) {
		  
		  function customValidator(ngModelValue) {
		
				// check if it's a combination of letters and numbers (no white spaces)
				// if it is, set our custom `addressValidator` to valid/true
				// otherwise set it to non-valid/false
				try {
					if (ngModelValue !== '') {
						bwcService.getBitcore().Address.fromString(ngModelValue);
					}
					ctrl.$setValidity('addressValidator', true);
				} catch(e) {
					ctrl.$setValidity('addressValidator', false);
				}

				// we need to return our ngModelValue, to be displayed to the user(value of the input)
				return ngModelValue;
			}

			// we need to add our customValidator function to an array of other(build-in or custom) functions
			// I have not notice any performance issues, but it would be worth investigating how much
			// effect does this have on the performance of the app
			ctrl.$parsers.push(customValidator);
			
	  }
	}
}]);

function htmlspecialchars (string, quote_style, charset, double_encode) {
  //       discuss at: http://phpjs.org/functions/htmlspecialchars/
  //      original by: Mirek Slugen
  //      improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  //      bugfixed by: Nathan
  //      bugfixed by: Arno
  //      bugfixed by: Brett Zamir (http://brett-zamir.me)
  //      bugfixed by: Brett Zamir (http://brett-zamir.me)
  //       revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  //         input by: Ratheous
  //         input by: Mailfaker (http://www.weedem.fr/)
  //         input by: felix
  // reimplemented by: Brett Zamir (http://brett-zamir.me)
  //             note: charset argument not supported
  //        example 1: htmlspecialchars("<a href='test'>Test</a>", 'ENT_QUOTES');
  //        returns 1: '&lt;a href=&#039;test&#039;&gt;Test&lt;/a&gt;'
  //        example 2: htmlspecialchars("ab\"c'd", ['ENT_NOQUOTES', 'ENT_QUOTES']);
  //        returns 2: 'ab"c&#039;d'
  //        example 3: htmlspecialchars('my "&entity;" is still here', null, null, false);
  //        returns 3: 'my &quot;&entity;&quot; is still here'

  var optTemp = 0,
    i = 0,
    noquotes = false
  if (typeof quote_style === 'undefined' || quote_style === null) {
    quote_style = 2
  }
  string = string || ''
  string = string.toString()
  if (double_encode !== false) {
    // Put this first to avoid double-encoding
    string = string.replace(/&/g, '&amp;')
  }
  string = string.replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  var OPTS = {
    'ENT_NOQUOTES': 0,
    'ENT_HTML_QUOTE_SINGLE': 1,
    'ENT_HTML_QUOTE_DOUBLE': 2,
    'ENT_COMPAT': 2,
    'ENT_QUOTES': 3,
    'ENT_IGNORE': 4
  }
  if (quote_style === 0) {
    noquotes = true
  }
  if (typeof quote_style !== 'number') {
    // Allow for a single string or an array of string flags
    quote_style = [].concat(quote_style)
    for (i = 0; i < quote_style.length; i++) {
      // Resolve string input to bitwise e.g. 'ENT_IGNORE' becomes 4
      if (OPTS[quote_style[i]] === 0) {
        noquotes = true
      } else if (OPTS[quote_style[i]]) {
        optTemp = optTemp | OPTS[quote_style[i]]
      }
    }
    quote_style = optTemp
  }
  if (quote_style & OPTS.ENT_HTML_QUOTE_SINGLE) {
    string = string.replace(/'/g, '&#039;')
  }
  if (!noquotes) {
    string = string.replace(/"/g, '&quot;')
  }

  return string
}
