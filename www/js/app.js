// TwinWallet Rebuild App

var Buffer = buffer.Buffer;

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
	$scope.show = function(template) {
		$ionicLoading.show({
			template: template,
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
//			address="2MzENBSFsusyfDzUQ8xbd7fEcvBfRk6Rk32";

		var walletClient1 = bwcService.getClient(),
			walletClient2 = bwcService.getClient(),
			walletClient3 = bwcService.getClient();

		var deferred1 = $q.defer(),
			deferred2 = $q.defer();

		$scope.show('<p>Retrieving wallet info...</p><ion-spinner></ion-spinner>'); // Shows the $ionicLoading spinner

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
					alert("Errore nella generazione dell'entropia (ERR_NOT512BIT_ENTROPY)")
					return;	
				}
				var xpriv = bwcService.getBitcore().HDPrivateKey.fromSeed(seed, CONFIG.NETWORK).toString();

				walletClient3.seedFromExtendedPrivateKey(xpriv);

				if (dataForm.target.title) {
			        $ionicPopup.confirm({
			          title: 'Chiave recuperata',
			          template: "Trasferire il portafoglio all'indirizzo " + dataForm.target.title + " ?"
			        }).then(function(yes) { // Confirm transfer?

			        	if (yes) {
			        		// Ok, confirmed!
							var deferredFee = $q.defer(),
								deferredAmount = $q.defer(),
								deferredTxp = $q.defer(),
								deferredSigned1 = $q.defer(),
								deferredSigned2 = $q.defer();
								deferredBroadcast = $q.defer();

							$scope.show('<p>Moving ...</p><ion-spinner></ion-spinner>'); // Shows the $ionicLoading spinner
							
							deferredFee.promise.then(function(feePerKB) {
								// Now we do have the feePerKB, so let's retrive the max available balance
								walletClient2.getBalance(function(err, balance) {
									var feeToSendMaxSat = parseInt(((balance.totalBytesToSendMax * feePerKB) / 1000.).toFixed(0));
								
									if (balance.availableAmount > feeToSendMaxSat) {
										if (balance.lockedAmount) { // Any pending transaction?
											walletClient2.getTxProposals({}, function(err, proposals) {
												if (err) {
													deferredAmount.reject(err);
												} else { // Let's abort them
													
													if (!proposals.length) throw("Internal error: lockedAmount > 0 with no pending txp");
													
													var deferred = [];
													for (var i=0; i < proposals.length; i++) {
														deferred.push($q.defer());
													}
													
													$q.all(deferred.map(function(d) {
														return d.promise;
													})).then(function(result) {
														deferredAmount.resolve(balance.availableAmount - feeToSendMaxSat);
													}, function(err) {
														deferredAmount.reject(err);
													});
													
													proposals.forEach(function(txp, i) {
														walletClient2.rejectTxProposal(txp, "Resetting wallet", function(err, obj) {
															if (err) {
																deferred[i].reject(err);
															} else {
																deferred[i].resolve();
															}
														});
													});
												}
											});
										} else {
											deferredAmount.resolve(balance.availableAmount - feeToSendMaxSat);
										}
									} else {
										deferredAmount.reject("Not enough satoshis");
									}
								});
								
								$scope.feePerKB = feePerKB;
							});
							
							deferredAmount.promise.then(function(availableMaxBalance) {
								// We have our max available Balance. Let's move it
								walletClient1.sendTxProposal({
									toAddress: dataForm.target.title,
									amount: availableMaxBalance,
									message: '',
									feePerKb: $scope.feePerKB,
									excludeUnconfirmedUtxos:  false
								}, function(err, txp) {
									if (err) {
										deferredTxp.reject(err);
									} else {
										deferredTxp.resolve(txp)
									}
								});
							});

							deferredTxp.promise.then(function(txp) {
								// Transaction Proposal. Let's sign it.
								walletClient1.signTxProposal(txp, function(err, signedTxp) {
									if (err) {
										deferredSigned1.reject(err);
									} else {
										deferredSigned1.resolve(signedTxp);
									}
								});
							});

							deferredSigned1.promise.then(function(signedTxp) {
								// The transaction proposal is now signed once.
								walletClient2.signTxProposal(signedTxp, function(err, signedTxp) {
									if (err) {
										deferredSigned2.reject(err);
									} else {
										deferredSigned2.resolve(signedTxp);
									}
								});
							});

							deferredSigned2.promise.then(function(signedTxp) {
								// The transaction proposal is now signed twice. Broadcast!
								walletClient2.broadcastTxProposal(signedTxp, function (err, btx, memo) {
									if (err) {
										deferredBroadcast.reject(err);
									} else {
										deferredBroadcast.resolve([btx, memo]);
										alert("Transazione completata correttamente.\nTrasferiti " + btx.amount + " satoshi");
									}
								});
							});
							
							$q.all([deferredFee.promise,
									deferredAmount.promise,
									deferredTxp.promise,
									deferredSigned1.promise,
									deferredSigned2.promise,
									deferredBroadcast.promise
							]).catch(function(err) {
								alert("Errore nel trasferimento del portafoglio (" + err + ")");
							}).finally(function() {
								$scope.hide();
							});

							// Trigger the promise chain
							walletClient1.getFeeLevels(walletClient1.credentials.network, function (err, levels) {
								if (err) {
									deferredFee.reject(err);
								} else {
									deferredFee.resolve(levels.filter(function(obj) {
										return obj.level === "normal";
									})[0].feePerKB);
								}
							});

			        	} else {
			        		alert("Operazione annullata!")
			        	}
			        });
				} else { // No address supplied => No transfer requested
					alert("Chiave recuperata: " + xpriv);
				}

			}, function(reason) { // Rejected
				// At least one promise did not resolve
			    var alertPopup = $ionicPopup.alert({
			      title: 'Errore nella creazione/recupero del wallet',
			      template: 'Risposta del server: ' + htmlspecialchars(reason.toString())
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

.directive('bcAddress', function() {
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
	          if (/^[A-Za-z1-9]*$/.test(ngModelValue)) {
	              ctrl.$setValidity('addressValidator', true);
	          } else {
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
});