///<reference path='./_references.d.ts'/>
import _                                            = require('underscore');
import express                                      = require('express');
var connect                                         = require('connect');
var RedisStore                                      = require('connect-redis')(connect);
import connect_flash                                = require("connect-flash");
import http                                         = require('http');
import path                                         = require('path');
import passport                                     = require('passport');
import Config                                       = require('./common/Config');
import Formatter                                    = require('./common/Formatter');
import ApiUrlDelegate                               = require('./delegates/ApiUrlDelegate');
import MysqlDelegate                                = require('./delegates/MysqlDelegate');
import IntegrationDelegate                          = require('./delegates/IntegrationDelegate');
import RequestHandler                               = require('./middleware/RequestHandler');
import api                                          = require('./api/index');
import routes                                       = require('./routes/index');
import CountryCode                                  = require('./enums/CountryCode');

var app:express.Application = express();

// all environments
app.use(express.compress());
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(
    function (req, res, next)
    {
        res.locals.formatMoney = Formatter.formatMoney;
        res.locals.formatRole = Formatter.formatRole;
        res.locals.formatName = Formatter.formatName;
        res.locals.formatSchedule = Formatter.formatSchedule;
        next();
    }
)
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
app.use(express.urlencoded());

app.use(express.methodOverride());
app.use(RequestHandler.parseRequest);
app.use(express.cookieParser());

app.use(express.session({
    secret: 'searchntalk.com',
    expires: new Date(Date.now() + (30 * 60 * 1000)), // 30 minutes
    store: new RedisStore({
        host: Config.get(Config.REDIS_HOST),
        port: Config.get(Config.REDIS_PORT)
    })
}));

app.use(passport.initialize());
app.use(passport.session({}));
app.use(connect_flash());

// APIs and Route endpoints
api(app);
routes(app);

_.templateSettings.interpolate = /\{\{(.+?)\}\}/g;

app.set('port', Config.get(Config.CORAL_PORT) || 3000);
app.listen(app.get('port'), function ()
{
    console.log("Demo Express server listening on port %d in %s mode", app.get('port'), app.settings.env);
});