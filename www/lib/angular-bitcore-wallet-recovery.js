
var Buffer = buffer.Buffer;

var bwrModule = angular.module('bwrModule', ['bwcModule', 'cscModule'])

bwrModule.constant("CONFIG", {
	BWS_URL : 'http://twtest.undo.it:3232/bws/api', //BitWalletService URL
	NETWORK : 'testnet'
});

bwrModule.service('bwrService', ['$q', 'bwcService', 'cscService', 'CONFIG', function ($q, bwcService, cscService, CONFIG) {

	bwcService.setBaseUrl(CONFIG.BWS_URL);
	
	this.move = function (from, to) {
		var retVal = $q.defer();
		
		setTimeout(function(){retVal.reject(5000);}, 2000);
		
		return retVal.promise;
	};

	this.getKey = function (words1, words2) {
		var walletClient1 = bwcService.getClient(),
			walletClient2 = bwcService.getClient();
	
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




	<script src="lib/angular-messages/angular-messages.min.js" type="text/javascript" charset="utf-8"></script>
	<script src="lib/angular-bitcore-wallet-client/angular-bitcore-wallet-client.min.js" type="text/javascript" charset="utf-8"></script>
	<script src="lib/angular-tooltips/dist/angular-tooltips.min.js" type="text/javascript" charset="utf-8"></script>
	<script src="lib/cosignclient/cosignclient-angular.js" type="text/javascript" charset="utf-8"></script>
	<script src="lib/nodebuffer.js" type="text/javascript" charset="utf-8"></script>
	<script src="lib/angular-bitcore-wallet-recovery.js" type="text/javascript" charset="utf-8"></script>
