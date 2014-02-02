/*
 * Copyright 2013-2014 Xiatron LLC
 */

//var twitterAPI = require('simple-twitter');
var twitterAPI = require('ntwitter');

module.exports = function() {
    /*
    *   Twitter social methods
    */
    this.twitter = function(creds) {
        //establish a new twitter client
        var twitterClient = new twitterAPI({
            consumer_key: creds.consumerKey, //consumer key
            consumer_secret: creds.consumerSecret, //consumer secret
            access_token_key: creds.accessToken, //access token
            access_token_secret: creds.accessSecret //access token secret
        });
        
        //tweet
        this.setStatus = function(status, callback) {
            //post the tweet then fire the callback
            twitterClient.updateStatus(status, callback);
        }
        
        //get profile
        this.getProfile = function(options, callback) {
            var params = {};
            if (options && options.user_id) {
                params['user_id'] = options.user_id;
            } else if (options && options.user_name) {
                params['screen_name'] = options.user_name;
            } else {
                params['user_id'] = creds.id;
            }
            
            //make the call
            twitterClient.get('/users/show.json', params, callback);
        }
        
        //get contacts
        this.getContacts = function(options, callback) {
            var params = {};
            if (options && options.user_id) {
                params['user_id'] = options.user_id;
            } else if (options && options.user_name) {
                params['screen_name'] = options.user_name;
            } else {
                params['user_id'] = creds.id;
            }
            
            //make the call
            twitterClient.get('/friends/list.json', params, callback);
        }
        
        //get followers
        this.getFollowers = function(options, callback) {
            var params = {};
            if (options && options.user_id) {
                params['user_id'] = options.user_id;
            } else if (options && options.user_name) {
                params['screen_name'] = options.user_name;
            } else {
                params['user_id'] = creds.id;
            }
            
            //make the call
            twitterClient.get('/followers/list.json', params, callback);
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
        
        //get profile
        this.getProfile = function(options, callback) {
            var param;
            if (options && options.user_id) {
                param = options.user_id;
            } else if (options && options.user_name) {
                param = options.user_name;
            } else {
                param = 'me';
            }
            
            //make the call
            facebookClient.get(param, callback);
        }
        
        //get contacts
        this.getContacts = function(options, callback) {
            var param; //facebook only supports 'me' but we'll build the params anyway in case that changes

            if (options && options.user_id) {
                param = options.user_id+'/friends';
            } else if (options && options.user_name) {
                param = options.user_name+'/friends';
            } else {
                param = 'me/friends';
            }
            
            //make the call
            facebookClient.get(param, callback);
        }
        
        //get followers
        this.getFollowers = function(options, callback) {
            var param; //facebook only supports 'me' but we'll build the params anyway in case that changes

            if (options && options.user_id) {
                param = options.user_id+'/subscribers';
            } else if (options && options.user_name) {
                param = options.user_name+'/subscribers';
            } else {
                param = 'me/subscribers';
            }
            
            //make the call
            facebookClient.get(param, callback);
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
            var params = { userId: 'me', collection: 'vault', access_token: creds.accessToken };
            googleClient.discover('plus', 'v1').execute(function(err, client) {
                client.plus.moments.insert(params, payload).execute(callback);
            });
        }
        
        //get profile
        this.getProfile = function(options, callback) {
            var params = { access_token: creds.accessToken };
            if (options && options.user_id) {
                params['userId'] = options.user_id;
            } else if (options && options.user_name) {
                params['userId'] = options.user_name;
            } else {
                params['userId'] = 'me';
            }
            
            //make the call
            googleClient.discover('plus', 'v1').execute(function(err, client) {
                client.plus.people.get(params).execute(callback);
            });
        }
        
        //get contacts
        this.getContacts = function(options, callback) {
            var params = { access_token: creds.accessToken, collection: 'visible' };
            if (options && options.user_id) {
                params['userId'] = options.user_id;
            } else if (options && options.user_name) {
                params['userId'] = options.user_name;
            } else {
                params['userId'] = 'me';
            }
            
            //make the call
            googleClient.discover('plus', 'v1').execute(function(err, client) {
                client.plus.people.list(params).execute(callback);
            });
        }
        
        //get followers
        this.getFollowers = function(options, callback) {
            callback(null, 'This is not supported by the Google Plus API');
        }
    }
    
}