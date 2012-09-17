var assert = require('assert');
var should = require('should');
var sinon = require('sinon');
var hoek = require("../lib/shot");

describe("hoek", function(){
  var emptyObj = {};
  var nestedObj = {
    x: 'x',
    y: 'y'
  }
  var dupsArray = [nestedObj, {z:'z'}, nestedObj];
  var reducedDupsArray = [nestedObj, {z:'z'}];
  
  describe("#getTimestamp", function(){
    it("should return a valid unix timestamp", function(done){
      (function(){
        var ts = hoek.getTimestamp();
        ts.should.be.a('number');
        var datetime = new Date(ts);
        (typeof datetime).should.equal('object');
      }).should.not.throw();
      done();
    })
  })

  describe("#removeKeys", function(){
    var objWithHiddenKeys = {
      location: {
        name: 'San Bruno'
      },
      company: {
        name: "@WalmartLabs"
      }
    }
    
    it("should delete params with definition's hide set to true", function(done){
      var a = hoek.removeKeys(objWithHiddenKeys, ['location']);
      should.not.exist(objWithHiddenKeys.location);
      should.exist(objWithHiddenKeys.company);
      done();
    })
  })
})