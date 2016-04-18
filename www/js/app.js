// TwinWallet Rebuild App

var Buffer = buffer.Buffer;

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
angular.module('starter', ['ionic', 'ngMessages', '720kb.tooltips', 'bwcModule', 'cscModule'])

.constant("CONFIG", {
	BWS_URL : 'http://twtest.undo.it:3232/bws/api', //BitWalletService URL
	NETWORK : 'testnet'
})

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

.controller('mainController', function($scope, $q, $ionicLoading, $ionicPopup, cscService, bwcService, CONFIG) {
	$scope.show = function() {
		$ionicLoading.show({
			template: '<p>Retrieving wallet info...</p><ion-spinner></ion-spinner>',
			delay: 0
		});
	};

	$scope.hide = function(){
        $ionicLoading.hide();
	};

	$scope.rebuildWallet = function(dataForm) {
		
		if (!dataForm.$valid) return; 

		bwcService.setBaseUrl(CONFIG.BWS_URL);
		
//		var words1="bargain crowd rule giggle divert brave wool west refuse ski sustain neglect",
//			words2="wife diesel actor broken clarify banana dignity craft exchange bar intact harbor";

		var walletClient1 = bwcService.getClient(),
			walletClient2 = bwcService.getClient(),
			walletClient3 = bwcService.getClient();

		var deferred1 = $q.defer(),
			deferred2 = $q.defer();

		$scope.show(); // Shows the $ionicLoading spinner

		setTimeout(function() {
			$q.all([deferred1.promise, deferred2.promise]).then(function(result) { // Resolved
				// Both promises were resolved -> Both wallets ready for joining
				result.forEach(function(val) {
					console.log(val);
				});

				var CSClient = cscService.getCSClient();
				var entropy1 = CSClient.extractServerEntropy(walletClient1.credentials);
				var entropy2 = CSClient.extractServerEntropy(walletClient2.credentials);

				// joinV2Update()
				function sort(buffs) {
					if (buffs[0].length > buffs[1].length) return buffs;
					if (buffs[0].length < buffs[1].length) return [buffs[1], buffs[0]];
					for (var i = buffs[0].length - 1; i >= 0; i--) {
						if (buffs[0][i] > buffs[1][i]) return buffs;
						if (buffs[0][i] < buffs[1][i]) return [buffs[1], buffs[0]];
					}
					return buffs;
				}

				var e1 = new Buffer(entropy1, 'base64');
				var e2 = new Buffer(entropy2, 'base64');
				var seed = Buffer.concat(sort([e1, e2]));
				if (seed.length != 64) {
					var popUp = $ionicPopup.show({
						title: "Errore nella generazione dell'entropia",
						subTitle: '(ERR_NOT512BIT_ENTROPY)',
						scope: $scope,
						buttons: [
							{ text: 'Ok',
							  type: 'button-positive'
							},
						]
					});
					
					return;	
				}
				var xpriv = bwcService.getBitcore().HDPrivateKey.fromSeed(seed, CONFIG.NETWORK).toString();

				walletClient3.seedFromExtendedPrivateKey(xpriv);

				var popUp = $ionicPopup.show({
					title: "Chiave recuperata:",
					subTitle: xpriv,
					scope: $scope,
					buttons: [
						{ text: 'Ok',
						  type: 'button-positive'
						},
					]
				});


				// TODO



			}, function(reason) { // Rejected
				// At least one promise did not resolve
				var popUp = $ionicPopup.show({
					title: 'Errore nella creazione/recupero del wallet',
					subTitle: 'Risposta del server: ' + reason,
					scope: $scope,
					buttons: [
						{ text: 'Ok',
						  type: 'button-positive'
						},
					]
				});
			}).finally(function () {
				$scope.hide();  // Hides the $ionicLoading spinner
			});

			walletClient1.importFromMnemonic(dataForm.secret1.title, {network : CONFIG.NETWORK}, function(err) {
				if(err) {
					if (err.code === "WALLET_DOES_NOT_EXIST") {
						// Recreate Wallet & Resolve
						try {
							walletClient1.seedFromMnemonic(dataForm.secret1.title, {network : CONFIG.NETWORK});
							deferred1.resolve("wallet1 recreated");
						} catch (e) {
							deferred1.reject(e);
						}
					} else {
						deferred1.reject(err);
					}
				} else { // Wallet exists
					deferred1.resolve("wallet1 exists");
				}
			});

			walletClient2.importFromMnemonic(dataForm.secret2.title, {network : CONFIG.NETWORK}, function(err) {
				if(err) {
					if (err.code === "WALLET_DOES_NOT_EXIST") {
						// Recreate Wallet & Resolve
						try {
							walletClient2.seedFromMnemonic(dataForm.secret2.title, {network : CONFIG.NETWORK});
							deferred2.resolve("wallet2 recreated");
						} catch (e) {
							deferred2.reject(e);
						}
					} else {
						deferred2.reject(err);
					}
				} else { // Wallet exists
					deferred2.resolve("wallet2 exists");
				}
			});

		}, 10); // Arbitrarily short delay. Needed for quickly displaying $ionicLoading

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
	          // if it is, set our custom `uppercaseValidator` to valid/true
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
    };
})

.directive('target-address', function() {
    return {

      // limit usage to argument only
      restrict: 'A',

      // require NgModelController, i.e. require a controller of ngModel directive
      require: 'ngModel',

      // create linking function and pass in our NgModelController as a 4th argument
      link: function(scope, element, attr, ctrl) {
		  
	      function customValidator(ngModelValue) {
        
	          // check if it's a twelve words phrase
	          // if it is, set our custom `uppercaseValidator` to valid/true
	          // otherwise set it to non-valid/false
			  
			  // TODOOOOOOO
			  
/*	          if (/^([A-Za-z]+\s){11}[A-Za-z]+$/.test(ngModelValue)) {
	              ctrl.$setValidity('twelveWordsValidator', true);
	          } else {
	              ctrl.$setValidity('twelveWordsValidator', false);
	          }*/

	          // we need to return our ngModelValue, to be displayed to the user(value of the input)
	          return ngModelValue;
	      }

	      // we need to add our customValidator function to an array of other(build-in or custom) functions
	      // I have not notice any performance issues, but it would be worth investigating how much
	      // effect does this have on the performance of the app
	      ctrl.$parsers.push(customValidator);
            
      }
    };
});