/*
 * Copyright 2013 Xiatron LLC
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

//config express and passport
passport.serializeUser(function(user, done) { done(null, user); });
passport.deserializeUser(function(obj, done) { done(null, obj); });
authServer.use(express.cookieParser());
authServer.use(express.session({ secret: 'SECRET' }));
authServer.use(passport.initialize());
authServer.use(passport.session());

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
    //TODO: add "enabled":false (include google too)
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
            res.redirect(host+'/');
        }
        
        //either send the current auth object or create one
        if (req.session.ref && (auths[req.session.ref] != undefined)) {
            res.send(auths[req.session.ref]);
        } else {
            setAuthObj(function(ref) {
                req.session.ref = ref;
                res.send(auths[req.session.ref]);
            });
        }
    });
        
    //setup generic authenticate route (redirect destination from specific provider routes)
    authServer.get('/authenticate', function(req, res) {
        if (passport._strategies[req.query.provider] == undefined) {
            invokeStrategy(req.query.provider, res);
        } else {
            if (req.query.provider == 'facebook') {
                passport.authenticate(req.query.provider, { display: 'touch' })(req, res);
            } else {
                passport.authenticate(req.query.provider)(req, res);
            }
        }
    });
    
    //setup facebook specific authenicate and callback routes
    authServer.get('/authenticate/facebook', function(req, res) { res.redirect(host+'/authenticate?provider=facebook'); });
    authServer.get('/facebook/callback', passport.authenticate('facebook'), function(req, res) {res.redirect(host+'/callback?provider=facebook');});

    //setup twitter specific authenicate and callback routes
    authServer.get('/authenticate/twitter', function(req, res) { res.redirect(host+'/authenticate?provider=twitter'); });
    authServer.get('/twitter/callback', passport.authenticate('twitter'), function(req, res) {res.redirect(host+'/callback?provider=twitter');});
    
    //setup google specific authenicate and callback routes
    authServer.get('/authenticate/google', function(req, res) { res.redirect(host+'/authenticate?provider=google'); });
    authServer.get('/google/callback', passport.authenticate('google'), function(req, res) {res.redirect(host+'/callback?provider=google');});

    //setup generic callback route (redirect destination from specific provider routes)
    authServer.get('/callback', function(req, res) {
        //generate a auth obj if we need one
        if (req.session.ref == undefined || (auths[req.session.ref] == undefined)) {
            setAuthObj(function(ref){
                req.session.ref = ref;
            });
        }
        
        //if there's no email provided by the provider (like twitter), we will create our own id
        var id = (req.user.emails == undefined) ? req.user.displayName.replace(' ','_').toLowerCase()+'_'+req.user.id : req.user.emails[0].value;
        
        //update the auth object values
        auths[req.session.ref]['authenticated'] = true;
        auths[req.session.ref]['provider'] = req.query.provider;
        auths[req.session.ref]['id'] = id;
        auths[req.session.ref]['full_profile'] = req.user;
        delete auths[req.session.ref]['auth_urls'];
               
        //check if we have a couch user and act accordingly
        hoodie.account.find('user', id, function(err, data){
            if (!err) {
                //set the auth time value (used for cleanup)
                auths[req.session.ref]['auth_time'] = new Date().getTime();
                
                //temporarily change the users password - this is where the magic happens!
                auths[req.session.ref]['temp_pass'] = Math.random().toString(36).slice(2,11);
                hoodie.account.update('user', id, {password:auths[req.session.ref]['temp_pass']}, function(err, data){ console.log(data); });
                
                //give the use some visual feedback that hey have been authenicated
                res.send('<html><head><script src="http://fgnass.github.io/spin.js/dist/spin.min.js"></script></head><body onload="/*self.close();*/" style="margin:0; padding:0; width:100%; height: 100%; display: table;"><div style="display:table-cell; text-align:center; vertical-align: middle;"><div id="spin" style="display:inline-block;"></div></div><script>var spinner=new Spinner().spin(); document.getElementById("spin").appendChild(spinner.el);</script></body></html>');
            } else {
                //assume it's because the couch user is not there and just create one
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
        config = hoodie.config.get(provider+'_config');
        if (config.enabled) {
            settings = config.settings;
            settings['failureRedirect'] = '/fail'; //todo - set this route up
            if (provider == 'facebook') {
                settings['callbackURL'] = host+'/facebook/callback';
                var providerStrategy = facebookStrategy;
                var verify = function(accessToken,refreshToken,profile,done){process.nextTick(function(){return done(null,profile);});}
            } else if (provider == 'twitter') {
                settings['callbackURL'] = host+'/twitter/callback';
                var providerStrategy = twitterStrategy;
                var verify = function(accessToken,refreshToken,profile,done){process.nextTick(function(){return done(null,profile);});}
            } else if (provider == 'google') {
                settings['returnURL'] = host+'/google/callback';
                settings['realm'] = host;
                var providerStrategy = googleStrategy;
                var verify = function(identifier,profile,done){process.nextTick(function(){return done(null,profile);});}
            }
            passport.use(new providerStrategy(settings,verify));
            res.redirect(host+'/authenticate/'+provider);
        } else {
            res.send('Provider not configured');
            return false;
        }
    }
    
    //function to assign a an auth object
    function setAuthObj(callback) {
        //generate random reference ID
        var ref = Math.random().toString(36).slice(2);
        
        //set a new request object for tracking progress
        auths[ref] = {
            "requested": new Date().getTime(),
            "authenticated":false,
            "auth_urls": {
                "facebook":host+"/authenticate/facebook",
                "twitter":host+"/authenticate/twitter",
                "google":host+"/authenticate/google"
            }
        };
        callback(ref);
    }
    
    //start the server on load
    var port = hoodie.config.get('port');
    authServer.listen(port);
    console.log('Hoodie Social Plugin: Listening on port '+port);
    
    //Hoodie Callback
    cb();
}