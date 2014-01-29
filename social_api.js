/*
 * Copyright 2013-2014 Xiatron LLC
 */

var twitterAPI = require('simple-twitter');

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
        this.setStatus = function(message, callback) {
            //post the tweet then fire the callback
            twitterClient.post('statuses/update', { status : message }, callback);
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
        this.setStatus = function(message, callback) {
            //post to the wall then fire the callback
            facebookClient.post('me/feed', {message: message}, callback);
        }
    }
    
    /*
    *   Google+ social methods - stubbed out for future use
    */
    this.google = function(creds) {
        //establish a new facebook client
        //TODO: find google plus api module or bake our own
    
        //post
        this.setStatus = function(message, callback) {
            //throw an error
            callback('The Google Plus api does not support status updates.');
        }
    }
    
}