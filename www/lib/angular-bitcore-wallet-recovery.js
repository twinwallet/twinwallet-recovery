
var Buffer = buffer.Buffer;

var bwrModule = angular.module('bwrModule', ['bwcModule', 'cscModule'])

bwrModule.constant("CONFIG", {
	BWS_URL : 'http://twtest.undo.it:3232/bws/api', //BitWalletService URL
//	BWS_URL : 'https://bws.bitpay.com/bws/api', //BitWalletService URL
	NETWORK : 'testnet'
});

bwrModule.service('bwrService', ['$q', 'bwcService', 'cscService', 'CONFIG', function ($q, bwcService, cscService, CONFIG) {

	bwcService.setBaseUrl(CONFIG.BWS_URL);

	var walletClient1 = bwcService.getClient(),
		walletClient2 = bwcService.getClient();
		
	var feePerKB = 0;
	
	/**
	 * move()
	 *
	 * @param from, to String |
	 * @return $q.deferred.promise |
	 */
	this.move = function (fromAddress, toAddress) {
		
		var deferredPending = $q.defer(),
			deferredFee = $q.defer(),
			deferredAmount = $q.defer(),
			deferredTxp = $q.defer(),
			deferredSigned1 = $q.defer(),
			deferredSigned2 = $q.defer();
			deferredBroadcast = $q.defer(),
			retVal = $q.defer();
			
		deferredPending.promise.then(function() { 
			// Now, with no pending transaction, let's compute the feePerKb
			walletClient1.getFeeLevels(CONFIG.NETWORK, function (err, levels) {
				if (err) {
					deferredFee.reject(err);
				} else {
					deferredFee.resolve(levels.filter(function(obj) {
						return obj.level === "normal";
					})[0].feePerKB);
				}
			});
		});
		
		deferredFee.promise.then(function(feePerKB) {
			// Now we do have the fee rate. We can compute the total fees
			walletClient2.getBalance({}, function(err, balance) {
				if (err) {
					deferredAmount.reject(err);
				} else {
					var feeToSendMaxSat = parseInt(((balance.totalBytesToSendMax * feePerKB) / 1000.).toFixed(0));
				
					if (balance.availableAmount > feeToSendMaxSat) {
						deferredAmount.resolve(balance.availableAmount - feeToSendMaxSat);
					} else {
						deferredAmount.reject("Not enough satoshis");
					}
				}
			});
			
			this.feePerKb = feePerKB;
		});

		deferredAmount.promise.then(function(availableMaxBalance) {
			// We have our max available Balance. Let's move it
			walletClient1.sendTxProposal({
				toAddress: toAddress,
				amount: 1000/*availableMaxBalance*/,
				message: '',
				feePerKb: this.feePerKb,
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
			// The transaction proposal is signed once.
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
			walletClient1.broadcastTxProposal(signedTxp, function (err, btx, memo) {
				if (err) {
					deferredBroadcast.reject(err);
				} else {
					deferredBroadcast.resolve([btx, memo]);
				}
			});
		});

		deferredBroadcast.promise.then(function(result) {
			retVal.resolve(result['btx'].amount);
		});

		// Error handler
		$q.all([deferredPending.promise,
				deferredFee.promise,
				deferredAmount.promise,
				deferredTxp.promise,
				deferredSigned1.promise,
				deferredSigned2.promise,
				deferredBroadcast.promise
		]).catch(function(err) {
			retVal.reject(err);
		});
			
		// Let's trigger the whole promise chain
		walletClient1.getTxProposals({}, function(err, proposals) {
			if (err) {
				deferredPending.reject(err);
			} else { 
				// Any pending transactions?
				if (!proposals.length) { // No. Let's go on.
					deferredPending.resolve();
				} else { // Yes. Let's abort them
					var deferred = [];
					for (var i=0; i < proposals.length; i++) {
						deferred.push($q.defer());
					}
				
					$q.all(deferred.map(function(d) {
						return d.promise;
					})).then(function(result) {
						deferredPending.resolve();
					}, function(err) {
						deferredPending.reject(err);
					});
				
					proposals.forEach(function(txp, i) {
						var callback = function (err) {
							if (err) {
								deferred[i].reject(err);
							} else {
								deferred[i].resolve();
							}
						}
					
						if (txp.creatorId === walletClient1.credentials.copayerId) {
							// walletClient1 did create the txp.
							walletClient1.removeTxProposal(txp, callback);
						} else if (txp.creatorId === walletClient2.credentials.copayerId) {
							// walletClient2 did create the txp.
							walletClient2.removeTxProposal(txp, callback);
						} else {
							// walletClient1 didn't create the txp, nor walletClient2. => Two Step Reject 
							walletClient1.rejectTxProposal(txp, "Resetting wallet", function(err, rejectedTxp) {
								if (err) {
									deferred[i].reject(err);
								} else {
									walletClient2.rejectTxProposal(txp, "Resetting Wallet", callback);
								}
							});
						}
					});
				}
			}
		});
		
		return retVal.promise;
	};

	/**
	 * getKey()
	 *
	 * @param words1, words2 String |
	 * @return $q.deferred.promise |
	 */
	this.getKey = function (words1, words2) {
	
		var deferred1 = $q.defer(),
			deferred2 = $q.defer(),
			retVal = $q.defer();
	
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
					retVal.reject("Errore nella generazione dell'entropia (ERR_NOT512BIT_ENTROPY)")
				} else {
					retVal.resolve(bwcService.getBitcore().HDPrivateKey.fromSeed(seed, CONFIG.NETWORK).toString());
				}
			}, function(reason) { // Reject
				retVal.reject(reason);
			});

			walletClient1.importFromMnemonic(words1, {network : CONFIG.NETWORK}, function(err) {
				if(err) {
					if (err.code === "WALLET_DOES_NOT_EXIST") {
						// Recreate Wallet & Resolve
						try {
							walletClient1.seedFromMnemonic(words1, {network : CONFIG.NETWORK});
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

			walletClient2.importFromMnemonic(words2, {network : CONFIG.NETWORK}, function(err) {
				if(err) {
					if (err.code === "WALLET_DOES_NOT_EXIST") {
						// Recreate Wallet & Resolve
						try {
							walletClient2.seedFromMnemonic(words2, {network : CONFIG.NETWORK});
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
		
		return retVal.promise;
	};
}]);
