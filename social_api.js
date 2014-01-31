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
            twitterClient.post('statuses/update', { status : status.message }, callback);
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
            facebookClient.post('me/feed', {message: status.message}, callback);
        }
    }
    
    /*
    *   Google+ social methods - stubbed out for future use
    */
    this.google = function(creds) {
        //establish a new facebook client
        var googleClient = require('googleapis');
        
        //post
        this.setStatus = function(status, callback) {
            googleClient.discover('plus', 'v1').execute(function(err, client) {
                var image = (status.image != undefined) ? status.image : 'http:\/\/www.google.com\/s2\/static\/images\/GoogleyEyes.png';
                var payload = {
                  type:'http:\/\/schemas.google.com\/AddActivity',
                  startDate: moment().format('YYYY-MM-DDTHH:mm:ssZ'),
                  target: {
                      id : Math.random().toString(36).slice(2),
                      image : image,
                      type : 'http:\/\/schema.org\/CreativeWork',
                      description : status.message,
                      name : status.title
                    }
                };
                
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