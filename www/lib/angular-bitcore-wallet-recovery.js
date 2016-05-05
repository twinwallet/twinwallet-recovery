
var Buffer = buffer.Buffer;

var bwrModule = angular.module('bwrModule', ['bwcModule', 'cscModule'])

bwrModule.constant("CONFIG", {
  BWS_URL : 'http://twtest.undo.it:3232/bws/api', //BitWalletService URL
//  BWS_URL : 'https://bws.bitpay.com/bws/api', //BitWalletService URL
  NETWORK : 'testnet',
});

bwrModule.service('bwrService', ['$q', 'bwcService', 'cosignkey', 'CONFIG', function ($q, bwcService, cosignkey, CONFIG) {

  bwcService.setBaseUrl(CONFIG.BWS_URL);

  this.walletClient1 = bwcService.getClient();
  this.walletClient2 = bwcService.getClient();
  this.walletClient3 = bwcService.getClient();
    
  this.feePerKB = 0;
  
  /**
   * move()
   *
   * @param from, to String |
   * @return $q.deferred.promise |
   */
  this.move = function (toAddress) {
    
    var deferred = $q.defer(),
      self = this;

    // Let's trigger the whole promise chain
    self.walletClient1.getTxProposals({}, function(err, proposals) {
      if (err) {
        deferred.reject(err);
      } else { 
        // Any pending transactions?
        if (!proposals.length) { // No. Let's go on.
          deferred.resolve();
        } else { // Yes. Let's abort them
          var deferreds = [];
          for (var i=0; i < proposals.length; i++) {
            deferreds.push($q.defer());
          }
      
          $q.all(deferreds.map(function(d) {
            return d.promise;
          })).then(function(result) {
            deferred.resolve();
          }, function(err) {
            deferred.reject(err);
          });
      
          proposals.forEach(function(txp, i) {
            var callback = function (err) {
              if (err) {
                deferreds[i].reject(err);
              } else {
                deferreds[i].resolve();
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
    
    return deferred.promise.then(function() {
      // Now, with no pending transaction, let's compute the feePerKb
			var d = $q.defer();
			
      self.walletClient1.getFeeLevels(CONFIG.NETWORK, function (err, levels) {
        if (err) {
          d.reject(err);
        } else {
          d.resolve(levels.filter(function(obj) {
            return obj.level === "normal";
          })[0].feePerKB);
        }
      });
			
			return d.promise;
			
    }).then(function(feePerKB) {
      // Now we do have the fee rate. We can compute the total fees
			var d = $q.defer();
			
      self.walletClient1.getBalance({}, function(err, balance) {
        if (err) {
          d.reject(err);
        } else {
          var feeToSendMaxSat = parseInt(((balance.totalBytesToSendMax * feePerKB) / 1000.).toFixed(0));
        
          if (balance.availableAmount > feeToSendMaxSat) {
            d.resolve(balance.availableAmount - feeToSendMaxSat);
          } else {
            d.reject("Not enough satoshis");
          }
        }
      });
      
      self.feePerKb = feePerKB;
			
			return d.promise;
			
    }).then(function(availableMaxBalance) {
      // We have our max available Balance. Let's move it
			var d = $q.defer();
			
      self.walletClient1.sendTxProposal({
        toAddress: toAddress,
        amount: availableMaxBalance,
        message: '',
        feePerKb: this.feePerKb,
        excludeUnconfirmedUtxos:  false
      }, function(err, txp) {
        if (err) {
          d.reject(err);
        } else {
          d.resolve(txp)
        }
      });
			
			return d.promise;
			
    }).then(function(txp) {
      // Transaction Proposal. Let's sign it.
			var d = $q.defer();

      self.walletClient1.signTxProposal(txp, function(err, signedTxp) {
        if (err) {
          d.reject(err);
        } else {
          d.resolve(signedTxp);
        }
      });
			
			return d.promise;
			
    }).then(function(signedTxp) {
      // The transaction proposal is signed once.
			var d = $q.defer();
			
      self.walletClient2.signTxProposal(signedTxp, function(err, signedTxp) {
        if (err) {
          d.reject(err);
        } else {
          d.resolve(signedTxp);
        }
      });
			
			return d.promise
			
    }).then(function(signedTxp) {
      // The transaction proposal is now signed twice. Broadcast!
			var d = $q.defer();
			
      self.walletClient1.broadcastTxProposal(signedTxp, function (err, btx, memo) {
        if (err) {
          d.reject(err);
        } else {
          d.resolve([btx, memo]);
        }
      });
			
			return d.promise
			
    }).then(function(result) {
			var d = $q.defer();
			
      d.resolve(result[0].amount);
			
			return d.promise
			
    });
  };

  /**
   * getKey()
   *
   * @param words1, words2 String |
   * @return $q.deferred.promise |
   */
  this.getKey = function (words1, words2) {
    var self = this;
    var deferred = $q.defer();

    // first async call. Don't need to defer it.
    self.walletClient1.importFromMnemonic(words1, {network : CONFIG.NETWORK}, function(err) {
      if(err) {
        if (err.code === "WALLET_DOES_NOT_EXIST" || err.message === "Copayer not found") {
          deferred.resolve("WALLET_DOES_NOT_EXIST");
        } else {
          deferred.reject(err);
        }
      } else {
        deferred.resolve("WALLET_EXISTS");
      }
    });
    
    return deferred.promise.then(function (result) {
      var d = $q.defer();
			
      if (result === 'WALLET_EXISTS') { // Wallet already known to the network
        self.walletClient2.importFromMnemonic(words2, {network : CONFIG.NETWORK}, function(err) {
          if (err) {
            // If the first wallet is know, so should be also the second wallet.
            // An import failure here should be impossibile, so let's handle it as an "assertion" failure.
            d.reject(err)
          } else { // Ok. Second wallet initialized.
            d.resolve("WALLET_EXISTS")
          }
        });
      } else { // Wallet unknow. We need to recreate it
        self.walletClient1.seedFromMnemonic(words1, {network : CONFIG.NETWORK}); // Client-side initialization
        self.walletClient1.createWallet('Twin Wallet', 'Device 1', 2, 3, {network: CONFIG.NETWORK}, function (err, secret) { // Server-side initialization
          if (err) {
            d.reject(err);
          } else { // Wallet created
            d.resolve(secret);
          }
        });
      }
			
      return d.promise;
			
    }).then(function (result) {
      var d = $q.defer();
			
      if (result === "WALLET_EXISTS") { // Wallet 2 initialized
          d.resolve("WALLET_EXISTS")
      } else { // Wallet doesn't exist, let's join the second client
        var secret = result;
        self.walletClient2.seedFromMnemonic(words2, {network : CONFIG.NETWORK}); // Client-side initialization
        self.walletClient2.joinWallet(secret, 'Device 2', {}, function (err, wallet) {
          if (err) { // Again. At this stage, an error is highly unpropable
            d.reject(err);
          } else {
            d.resolve(secret)
          }
        });
      }
			
      return d.promise;
			
    }).then(function (result) {
      return $q(function (resolve, reject) {
        try {
          var entropy1 = cosignkey.extractServerEntropy(self.walletClient1.credentials);
          var entropy2 = cosignkey.extractServerEntropy(self.walletClient2.credentials);
          var xpriv = cosignkey.get3rdKeyXPriv(entropy1, entropy2, CONFIG.NETWORK);
        } catch (e) {
          return reject("Errore nella generazione dell'entropia (ERR_NOT512BIT_ENTROPY)");
        }
        if (result === "WALLET_EXISTS") {
          resolve(xpriv);
        } else { // Wallet doesn't exist. Let's join
          var secret = result;
          self.walletClient3.seedFromExtendedPrivateKey(xpriv);
          self.walletClient3.joinWallet(secret, 'Device 3', {}, function (err, wallet) {
            if (err) { // Again. At this stage, an error is highly unpropable
              reject(err);
            } else {
              resolve(xpriv)
            }
          });
        }
      });
    }).then(function (result) {
      var d = $q.defer();
			
      // At this point all three wallets have been created
      // Let's wait for the completions of the publicKeyRing
      self.walletClient1.openWallet(function (err, status) {
        if (err) {
          d.reject(err);
        } else {
          d.resolve(result);
        }
      })
				
      return d.promise;
			
    }).then(function (result) {
      var d = $q.defer();
      // TODO verificare cosa restituire all'utente dopo la creazione del wallet/indirizzo
      self.walletClient1.getMainAddresses({}, function (err, addr) {
        if (err) {
          d.reject(err);
        //} else if (addr.length === 0) { // No address defined yet
        //  // Let's create it.
        //  self.walletClient1.createAddress({}, function(err, address) {
        //    if (err) {
        //      d.reject(err);
        //    } else {
        //      // TODO vedi sopra
        //      d.resolve(result);
        //    }
        //  });
        } else {
          // TODO vedi sopra
          d.resolve(result);
        }
      })
			
      return d.promise;
			
    });
  };
}]);
