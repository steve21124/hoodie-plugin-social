/*
 * Copyright 2013-2014 Xiatron LLC
 */

//set some vars
var express = require('express');
var passport = require('passport');
var util = require('util');
var ports = require('ports');
var appName = module.parent.filename.match('.*\/(.+?)\/node_modules')[1];
var facebookStrategy = require('passport-facebook').Strategy;
var twitterStrategy = require('passport-twitter').Strategy;
var googleStrategy = require('passport-google').Strategy;
var authServer = express();
var auths = {};
var host = null;
var socialApi = require('./social_api.js');
var moment = require('moment');
var socialTasks = []; //keeps track of social active tasks


//config express and passport
passport.serializeUser(function(user, done) { done(null, user); });
passport.deserializeUser(function(obj, done) { done(null, obj); });
authServer.use(express.cookieParser());
authServer.use(express.session({ secret: 'SECRET' }));
authServer.use(passport.initialize());
authServer.use(passport.session());
authServer.use(express.bodyParser());

// Add headers to support CORS
authServer.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', req.header('origin'));
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');
    next(); //pass to next layer of middleware
});

//run the rest in the hoodie context
module.exports = function (hoodie, cb) {    
    //check for plugin config items and set if not there
    if (!hoodie.config.get('port')) hoodie.config.set('port', ports.getPort(appName+'-hoodie-plugin-social'));
    if (!hoodie.config.get('facebook_config')) hoodie.config.set('facebook_config', {"enabled":false,"settings":{"clientID":"","clientSecret":""}});
    if (!hoodie.config.get('twitter_config')) hoodie.config.set('twitter_config', {"enabled":false,"settings":{"consumerKey":"","consumerSecret":""}});
    if (!hoodie.config.get('google_config')) hoodie.config.set('google_config', {"enabled":false,"settings":{}});
    
    //get the CouchDB config then setup proxy
    hoodie.request('get', '_config', {}, function(err, data){
        var port = hoodie.config.get('port');
        if (!data.httpd_global_handlers._auth || (data.httpd_global_handlers._auth.indexOf(port) == -1)) {
            var value = '{couch_httpd_proxy, handle_proxy_req, <<"http://0.0.0.0:'+port+'">>}';
            hoodie.request('PUT', '_config/httpd_global_handlers/_auth/', {data:JSON.stringify(value)},function(err, data){
                if (err) console.log(err);
            });
        }
    });
        
    //setup base route for front end status calls
    authServer.get('/', function(req, res) {
        //set the host directly from front end query parameter
        //work around until https://github.com/hoodiehq/hoodie-server/issues/183 is resolved
        if (req.query.uri) host = req.query.uri;
        
        //check if we intend to destroy the current auth object
        if (req.query.destroy == 'true' && req.session.ref) {
            delete auths[req.session.ref];
            req.session.destroy();
            res.redirect(host+req.url.replace('destroy=true','destroy=false'));
            return false;
        }
        
        //either send the current auth object or create one
        if ((req.session.ref != undefined) && (auths[req.session.ref] != undefined)) {
            res.send(auths[req.session.ref]);
            delete auths[req.session.ref]['temp_pass']; //only give it once!
        } else {
            setAuthObj({method: req.query.method, id: req.query.userid}, function(ref) {
                req.session.ref = ref;
                res.send(auths[req.session.ref]);
            });
        }
    });
    
    //listen for tasks to set status
    var social = new socialApi();
    hoodie.task.on('add:setstatus', function (db, doc) {
        var process = function() {
            if (socialTasks.indexOf(db) > -1) {
                setTimeout(process,50);
            } else  {
                //lock (to avoid the rare case of concurrent conflicting writes)
                socialTasks.push(db);
                
                //process
                if (doc.provider && doc.userid && doc.message) {
                    var creds = { accessToken: null };
                    
                    hoodie.account.find('user', doc.userid, function(err, data){
                        if (doc.provider == 'twitter') {
                            var providerConfig = hoodie.config.get('twitter_config');
                            creds['consumerKey'] = providerConfig.settings.consumerKey;
                            creds['consumerSecret'] = providerConfig.settings.consumerSecret;
                            creds['accessSecret'] = data.connections[doc.provider]['secret'];
                        }
                        if (data.connections[doc.provider] != undefined) creds['accessToken'] = data.connections[doc.provider]['token'];
                        
                        var apiClient = new social[doc.provider](creds);
                        apiClient.setStatus(doc.message, function(err, data){
                            var response = (err) ? err : data;
                            //clear the lock
                            socialTasks.splice(socialTasks.indexOf(db), 1);
                            
                            //mimic a 'hoodie.task.success(db, doc)' but add the doneData object
                            doc['$processedAt'] = moment().format();
                            doc['_deleted'] = true;
                            doc['doneData'] = response;
                            hoodie.database(db).update(doc.type, doc.id, doc, function(err, data){ if(err) console.log(err); });
                        });
                    });
                }
            }
        }
        process();
    });
        
    //setup generic authenticate route (redirect destination from specific provider routes)
    authServer.get('/auth', function(req, res) {
        if (passport._strategies[req.query.provider] == undefined) {
            invokeStrategy(req.query.provider, res);
        } else {
            if (req.query.provider == 'facebook') {
                if (!req.isAuthenticated()) { //TODO: Do we really need to use authorize()?  It seems like we would get he same reult with authenicate().
                    passport.authenticate(req.query.provider, { display: 'touch' })(req, res);
                } else {
                    passport.authorize(req.query.provider, { display: 'touch' })(req, res);
                }
            } else {
                if (!req.isAuthenticated()) {
                    passport.authenticate(req.query.provider)(req, res);
                } else {
                    passport.authorize(req.query.provider)(req, res);
                }
            }
        }
    });
    
    //setup facebook specific authenicate and callback routes
    authServer.get('/auth/facebook', function(req, res) { res.redirect(host+'/auth?provider=facebook'); });
    authServer.get('/facebook/callback', passport.authenticate('facebook'), function(req, res) {res.redirect(host+'/callback?provider=facebook');});

    //setup twitter specific authenicate and callback routes
    authServer.get('/auth/twitter', function(req, res) { res.redirect(host+'/auth?provider=twitter'); });
    authServer.get('/twitter/callback', passport.authenticate('twitter'), function(req, res) {res.redirect(host+'/callback?provider=twitter');});
    
    //setup google specific authenicate and callback routes
    authServer.get('/auth/google', function(req, res) { res.redirect(host+'/auth?provider=google'); });
    authServer.get('/google/callback', passport.authenticate('google'), function(req, res) {res.redirect(host+'/callback?provider=google');});

    //setup generic callback route (redirect destination from specific provider routes)
    authServer.get('/callback', function(req, res) {
        if (auths[req.session.ref]['id'] == undefined) {
            //if there's no email provided by the provider (like twitter), we will create our own id
            var id = (req.user.emails == undefined) ? req.user.displayName.replace(' ','_').toLowerCase()+'_'+req.user.id : req.user.emails[0].value;
        } else {
            var id = auths[req.session.ref]['id'];
        }
        
        //check if we have a couch user and act accordingly
        hoodie.account.find('user', id, function(err, data){
            var updateVals = {};
            
            if (!err) {
                if (auths[req.session.ref]['method'] == 'login' && !auths[req.session.ref]['authenticated']) {
                    auths[req.session.ref]['provider'] = req.query.provider;
                    auths[req.session.ref]['id'] = id;
                    auths[req.session.ref]['full_profile'] = req.user;
                
                    auths[req.session.ref]['authenticated'] = true;
                
                    //set the auth time value (used for cleanup)
                    auths[req.session.ref]['auth_time'] = new Date().getTime();
                    
                    //temporarily change the users password - this is where the magic happens!
                    auths[req.session.ref]['temp_pass'] = Math.random().toString(36).slice(2,11);
                    
                    //update password
                    updateVals['password'] = auths[req.session.ref]['temp_pass'];
                }
                
                //always update connections
                var connections = (data.connections) ? data.connections : {};
                connections[req.query.provider] = auths[req.session.ref]['connections'][req.query.provider];
                updateVals['connections'] = connections;
                                
                //update values
                hoodie.account.update('user', id, updateVals, function(err, data){ console.log(data); });
                
                //mark as complete
                auths[req.session.ref]['complete'] = true;
                
                //give the user some visual feedback
                res.send('<html><head><script src="http://fgnass.github.io/spin.js/dist/spin.min.js"></script></head><body onload="/*self.close();*/" style="margin:0; padding:0; width:100%; height: 100%; display: table;"><div style="display:table-cell; text-align:center; vertical-align: middle;"><div id="spin" style="display:inline-block;"></div></div><script>var spinner=new Spinner().spin(); document.getElementById("spin").appendChild(spinner.el);</script></body></html>');
            } else {
                //assume the error is because the couch user is not there and just create one
                var uuid = Math.random().toString(36).slice(2,9);
                var timeStamp = new Date();
                var userdoc = {
                    id: id,
                    password: Math.random().toString(36).slice(2,11),
                    ownerHash: uuid,
                    createdAt: timeStamp,
                    updatedAt: timeStamp,
                    signedUpAt: timeStamp,
                    database: 'user/'+uuid,
                    name: 'user/'+id
                };
                hoodie.account.add('user', userdoc, function(err, data){
                    //cycle back through so we can catch the fully created user
                    if (!err) res.redirect(host+'/'+req.query.provider+'/callback');
                });
            }
        });
    });
    
    //No need to keep this stuff around, so lets clean up after ourselves
    var cleanupInterval = setInterval(function() {cleanupAuths();},15000);
    function cleanupAuths() {
        var now = new Date().getTime();
        for(var i in auths) {
            if (now - auths[i].auth_time >= 30000) {
                delete auths[i];
            }
        }
    }
    
    //function to invoke a strategy
    function invokeStrategy(provider, res) {
        var config = hoodie.config.get(provider+'_config');
        if (config.enabled) {
            var settings = config.settings;
            settings['passReqToCallback'] = true;
            settings['failureRedirect'] = '/fail'; //todo - set this route up
            if (provider == 'facebook') {
                settings['callbackURL'] = host+'/facebook/callback';
                var providerStrategy = facebookStrategy;
                var verify = function(req, accessToken,refreshToken,profile,done){ auths[req.session.ref]['connections'][provider] = {token: accessToken};  process.nextTick(function(){return done(null,profile);});}
            } else if (provider == 'twitter') {
                settings['callbackURL'] = host+'/twitter/callback';
                var providerStrategy = twitterStrategy;
                var verify = function(req, accessToken,tokenSecret,profile,done){ auths[req.session.ref]['connections'][provider] = {token: accessToken, secret: tokenSecret};  process.nextTick(function(){return done(null,profile);});}
            } else if (provider == 'google') {
                settings['returnURL'] = host+'/google/callback';
                settings['realm'] = host;
                var providerStrategy = googleStrategy;
                var verify = function(req, identifier,profile,done){process.nextTick(function(){return done(null,profile);});}
            }
            passport.use(new providerStrategy(settings,verify));
            res.redirect(host+'/auth/'+provider);
        } else {
            res.send('Provider not configured');
            return false;
        }
    }
        
    //function to assign a an auth object
    function setAuthObj(options, callback) {
        //generate random reference ID
        var ref = Math.random().toString(36).slice(2);
        
        //set a new request object for tracking progress
        auths[ref] = {
            "method": options.method,
            "requested": new Date().getTime(),
            "authenticated":false, /*depreciated*/
            "complete": false,
            "auth_urls": {
                "facebook":host+"/auth/facebook",
                "twitter":host+"/auth/twitter",
                "google":host+"/auth/google"
            },
            "connections": {}
        };
        
        //set the id if we have it
        if (options.id) auths[ref]['id'] = options.id;
        
        callback(ref);
    }
    
    //start the server on load
    var port = hoodie.config.get('port');
    authServer.listen(port);
    console.log('Hoodie Social Plugin: Listening on port '+port);
    
    //Hoodie Callback
    cb();
}