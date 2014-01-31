/*
 * Copyright 2013-2014 Xiatron LLC
 */

var twitterAPI = require('simple-twitter');
var moment = require('moment');

module.exports = function() {
    /*
    *   Twitter social methods
    */
    this.twitter = function(creds) {
        //establish a new twitter client
        var twitterClient = new twitterAPI(
            creds.consumerKey, //consumer key
            creds.consumerSecret, //consumer secret
            creds.accessToken, //access token
            creds.accessSecret, //access token secret
            false //(optional) get file cache time time in seconds or false
        );
        
        //tweet
        this.setStatus = function(status, callback) {
            //post the tweet then fire the callback
            twitterClient.post('statuses/update', { status : status }, callback);
        }
    }
    
    /*
    *   Facebook social methods
    */
    this.facebook = function(creds) {
        //establish a new facebook client
        var facebookClient = require('fbgraph');
        facebookClient.setAccessToken(creds.accessToken);
        
        //post
        this.setStatus = function(status, callback) {
            //post to the wall then fire the callback
            facebookClient.post('me/feed', { message: status }, callback);
        }
    }
    
    /*
    *   Google+ social methods - stubbed out for future use
    */
    this.google = function(creds) {
        //establish a new facebook client
        var googleClient = require('googleapis');
        
        //post
        this.setStatus = function(payload, callback) {
            googleClient.discover('plus', 'v1').execute(function(err, client) {
                client.plus.moments.insert({
                     userId: 'me',
                     collection: 'vault',
                     access_token: creds.accessToken
                  }, payload)
                 .execute(callback);
            });
        }
    }
    
}