var cosignkey = require('cosignkey');

angular.module('cosignKeyModule', []).service("cosignkey", ['bwcService', function (bwcService) {
  var Bitcore = bwcService.getBitcore();

  this.extractServerEntropy = function (credentials) {
    var hdk = Bitcore.HDPrivateKey(credentials.xPrivKey);
    return cosignkey.extractEntropy(hdk._buffers.privateKey, hdk._buffers.chainCode);
  };

  this.get3rdKeyXPriv = function (entropy1, entropy2, network) {
    var seed = cosignKey.get3rdKeySeed(entropy1, entropy2);
    return Bitcore.HDPrivateKey.fromSeed(seed, network).toString();
  }
}]);
