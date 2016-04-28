
var Buffer = buffer.Buffer;

var bwrModule = angular.module('bwrModule', ['bwcModule', 'cscModule'])

bwrModule.constant("CONFIG", {
	BWS_URL : 'http://twtest.undo.it:3232/bws/api', //BitWalletService URL
//	BWS_URL : 'https://bws.bitpay.com/bws/api', //BitWalletService URL
	NETWORK : 'testnet',
	NOTIFICATION_INTERVAL : {notificationIntervalSeconds: 0.2}
});

bwrModule.service('bwrService', ['$q', 'bwcService', 'cscService', 'CONFIG', function ($q, bwcService, cscService, CONFIG) {

	bwcService.setBaseUrl(CONFIG.BWS_URL);

	this.walletClient1 = bwcService.getClient();
	this.walletClient2 = bwcService.getClient();
	this.walletClient3 = bwcService.getClient();
		
	this.feePerKB = 0;

	function sort(buffs) {
		if (buffs[0].length > buffs[1].length) return buffs;
		if (buffs[0].length < buffs[1].length) return [buffs[1], buffs[0]];
		for (var i = buffs[0].length - 1; i >= 0; i--) {
			if (buffs[0][i] > buffs[1][i]) return buffs;
			if (buffs[0][i] < buffs[1][i]) return [buffs[1], buffs[0]];
		}
		return buffs;
	}
	
	/**
	 * move()
	 *
	 * @param from, to String |
	 * @return $q.deferred.promise |
	 */
	this.move = function (toAddress) {
		
		var deferredPending = $q.defer(),
			deferredFee = $q.defer(),
			deferredAmount = $q.defer(),
			deferredTxp = $q.defer(),
			deferredSigned1 = $q.defer(),
			deferredSigned2 = $q.defer();
			deferredBroadcast = $q.defer(),
			retVal = $q.defer(),
			self = this;
			
/*		self.walletClient1.getStatus({}, function(err, status) {
				console.debug(self.walletClient1.isComplete(), err, status);
		});*/
			
		self.walletClient1.getTxProposals({}, function(err, props) {
			console.debug(err, props);
		});
			
		return;

		deferredPending.promise.then(function() {
			// Now, with no pending transaction, let's compute the feePerKb
			self.walletClient1.getFeeLevels(CONFIG.NETWORK, function (err, levels) { console.debug("feelEvels");
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
			self.walletClient1.getBalance({}, function(err, balance) { console.debug("getBalan");
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
			
			self.feePerKb = feePerKB;
		});

		deferredAmount.promise.then(function(availableMaxBalance) {
			// We have our max available Balance. Let's move it
			self.walletClient1.sendTxProposal({
				toAddress: toAddress,
				amount: availableMaxBalance,
				message: '',
				feePerKb: this.feePerKb,
				excludeUnconfirmedUtxos:  false
			}, function(err, txp) { console.debug("sendTxp");
				if (err) {
					deferredTxp.reject(err);
				} else {
					deferredTxp.resolve(txp)
				}
			});
		});

		deferredTxp.promise.then(function(txp) {
			// Transaction Proposal. Let's sign it.
			self.walletClient1.signTxProposal(txp, function(err, signedTxp) { console.debug("sign1Txp");
				if (err) {
					deferredSigned1.reject(err);
				} else {
					deferredSigned1.resolve(signedTxp);
				}
			});
		});

		deferredSigned1.promise.then(function(signedTxp) {
			// The transaction proposal is signed once.
			self.walletClient2.signTxProposal(signedTxp, function(err, signedTxp) { console.debug("sign2Txp");
				if (err) {
					deferredSigned2.reject(err);
				} else {
					deferredSigned2.resolve(signedTxp);
				}
			});
		});

		deferredSigned2.promise.then(function(signedTxp) {
			// The transaction proposal is now signed twice. Broadcast!
			self.walletClient1.broadcastTxProposal(signedTxp, function (err, btx, memo) { console.debug("lanciolargo");
				if (err) {
					deferredBroadcast.reject(err);
				} else {
					deferredBroadcast.resolve([btx, memo]);
				}
			});
		});

		deferredBroadcast.promise.then(function(result) { console.debug("resolve");
			retVal.resolve(result[0].amount);
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
		self.walletClient1.getTxProposals({}, function(err, proposals) { console.debug("getTx");
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
					
						if (txp.creatorId === self.walletClient1.credentials.copayerId) { // walletClient1 did create the txp.
							if (txp.status === 'accepted') { // Already signed twice
								self.walletClient1.broadcastTxProposal(txp, callback);
							} else {
								self.walletClient1.removeTxProposal(txp, callback);
							}
						} else if (txp.creatorId === self.walletClient2.credentials.copayerId) { // walletClient2 did create the txp.
							if (txp.status === 'accepted') { // Already signed twice
								self.walletClient2.broadcastTxProposal(txp, callback);
							} else {
								self.walletClient2.removeTxProposal(txp, callback);
							}
						} else { // walletClient1 didn't create the txp, nor walletClient2. => Two Step Reject
							if (txp.status === 'accepted') { // Already signed twice
								self.walletClient1.broadcastTxProposal(txp, callback);
							} else {
								self.walletClient1.rejectTxProposal(txp, "Resetting wallet", function(err, rejectedTxp) {
									if (err) {
										deferred[i].reject(err);
									} else {
										self.walletClient2.rejectTxProposal(txp, "Resetting Wallet", callback);
									}
								});
							}
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
	
		var deferredWallet1 = $q.defer(),
			deferredWallet2 = $q.defer(),
			deferredWallet3 = $q.defer(),
			deferredXPrivKey = $q.defer(),
			retVal = $q.defer(),
			self = this;
			
		deferredWallet1.promise.then(function(result) {
			if (result === 'WALLET_EXISTS') { // Wallet already known to the network
				self.walletClient2.importFromMnemonic(words2, {network : CONFIG.NETWORK}, function(err) { console.debug("importW2");
					if (err) {
						// If the first wallet is know, so should be also the second wallet.
						// An import failure here should be impossibile, so let's handle it as an "assertion" failure. 
						deferredWallet2.reject(err)
					} else { // Ok. Second wallet initialized.
						deferredWallet2.resolve("WALLET_EXISTS")
					}
				});
			} else { // Wallet unknow. We need to recreate it
				self.walletClient1.seedFromMnemonic(words1, {network : CONFIG.NETWORK}); // Client-side initialization
				self.walletClient1.createWallet('Twin Wallet', 'Device 1', 2, 3, {network: CONFIG.NETWORK}, function (err, secret) { // Server-side initialization


 console.debug("creatuno");


					if (err) {
						deferredWallet2.reject(err);
					} else { // Wallet created
						deferredWallet2.resolve(secret);
					}
				});
			}
		});

		deferredWallet2.promise.then(function(result) {
			if (result === "WALLET_EXISTS") { // Wallet 2 initialized
				deferredWallet3.resolve("WALLET_EXISTS")
			} else { // Wallet doesn't exist, let's join the second client
				var secret = result;
				self.walletClient2.joinWallet(secret, 'Device2', {}, function (err, wallet) {

 console.debug("joinW2");


					if (err) { // Again. At this stage, an error is highly unpropable
						deferredWallet3.reject(err);
					} else {
						deferredWallet3.resolve(secret)
					}
				});
			}
		});

		deferredWallet3.promise.then(function(result) {
			var CSClient = cscService.getCSClient();
			var entropy1 = CSClient.extractServerEntropy(self.walletClient1.credentials);
			var entropy2 = CSClient.extractServerEntropy(self.walletClient2.credentials);

			var e1 = new Buffer(entropy1, 'base64');
			var e2 = new Buffer(entropy2, 'base64');
			var seed = Buffer.concat(sort([e1, e2]));

			if (seed.length != 64) {
				deferredXPrivKey.reject("Errore nella generazione dell'entropia (ERR_NOT512BIT_ENTROPY)")
			} else {
				var xpriv = bwcService.getBitcore().HDPrivateKey.fromSeed(seed, CONFIG.NETWORK).toString();
				if (result === "WALLET_EXISTS") {
					deferredXPrivKey.resolve(xpriv);
				} else { // Wallet doesn't exist. Let's join
					var secret = result;
					self.walletClient3.seedFromExtendedPrivateKey(xpriv);
					self.walletClient3.joinWallet(secret, 'Device3', {}, function (err, wallet) {


 console.debug("joinW3");


						if (err) { // Again. At this stage, an error is highly unpropable
							deferredXPrivKey.reject(err);
						} else {
							deferredXPrivKey.resolve(xpriv)
						}
					});
				}
			}
		});

		deferredXPrivKey.promise.then(function (result) {
			retVal.resolve(result);
		});

		// Error handler
		$q.all([deferredWallet1.promise,
				deferredWallet2.promise,
				deferredWallet3.promise,
				deferredXPrivKey.promise
		]).catch(function(err) {
			retVal.reject(err);
		});
		
		self.walletClient1.importFromMnemonic(words1, {network : CONFIG.NETWORK}, function(err) { console.debug("importW1");
			if(err) {
				if (err.code === "WALLET_DOES_NOT_EXIST" || err.message === "Copayer not found") {
					deferredWallet1.resolve("WALLET_DOES_NOT_EXIST");
				} else {
					deferredWallet1.reject(err);
				}
			} else {
				deferredWallet1.resolve("WALLET_EXISTS");
			}
		});
		
		return retVal.promise;
	};
}]);
