///<reference path='../../_references.d.ts'/>
import express                                              = require('express');
import passport                                             = require('passport');
import RequestHandler                                       = require('../../middleware/RequestHandler');
import OAuthProviderDelegate                                = require('../../delegates/OAuthProviderDelegate');
import AuthenticationDelegate                               = require('../../delegates/AuthenticationDelegate');
import IntegrationMemberDelegate                            = require('../../delegates/IntegrationMemberDelegate');
import VerificationCodeCache                                = require('../../caches/VerificationCodeCache');
import IntegrationDelegate                                  = require('../../delegates/IntegrationDelegate');
import Integration                                          = require('../../models/Integration');
import User                                                 = require('../../models/User');
import ApiConstants                                         = require('../../enums/ApiConstants');
import IntegrationType                                      = require('../../enums/IntegrationType');
import IncludeFlag                                          = require('../../enums/IncludeFlag');
import Config                                               = require('../../common/Config');
import Utils                                                = require('../../common/Utils');
import Urls                                                 = require('./Urls');

class ExpertRegistrationRoute
{
    constructor(app)
    {
        // Pages
        app.get(Urls.index(), RequestHandler.noCache, this.authenticate);
        app.get(Urls.authorization(), OAuthProviderDelegate.authorization, this.authorize);
        app.get(Urls.complete(), this.expertComplete);

        // Auth
        app.post(Urls.login(), passport.authenticate(AuthenticationDelegate.STRATEGY_LOGIN, {failureRedirect: Urls.index(), failureFlash: true}), this.authenticationSuccess);
        app.post(Urls.register(), AuthenticationDelegate.register({failureFlash: true}), this.authenticationSuccess.bind(this));
        app.get(Urls.linkedInLogin(), passport.authenticate(AuthenticationDelegate.STRATEGY_LINKEDIN_EXPERT_REGISTRATION, {scope: ['r_basicprofile', 'r_emailaddress']}));
        app.get(Urls.linkedInLoginCallback(), passport.authenticate(AuthenticationDelegate.STRATEGY_LINKEDIN_EXPERT_REGISTRATION, {failureFlash: true, scope: ['r_basicprofile', 'r_emailaddress']}), this.authenticationSuccess);
        app.post(Urls.authorizationDecision(), OAuthProviderDelegate.decision);
    }

    /* Render login/register page */
    private authenticate(req:express.Request, res:express.Response):any
    {
        var integrationId = req.query[ApiConstants.INTEGRATION_ID] || req.session[ApiConstants.INTEGRATION_ID];
        var integration = new IntegrationDelegate().getSync(integrationId);
        var invitationCode:string = req.query[ApiConstants.CODE] || req.session[ApiConstants.CODE];

        if (Utils.isNullOrEmpty(integration))
            return res.send(404, 'The integration id was not found');

        req.session[ApiConstants.INTEGRATION_ID] = integrationId;
        req.session[ApiConstants.CODE] = invitationCode;

        new VerificationCodeCache().searchInvitationCode(invitationCode, integrationId)
            .then(
            function verified()
            {
                req.session[ApiConstants.INTEGRATION_ID] = integrationId;
                res.render('expertRegistration/authenticate', {'integration': integration, messages: req.flash()});
            },
            function verificationFailed() { res.send(401, "This is an invite only section"); }
        );
    }


    /* Handle authentication success -> Redirect to authorization */
    private authenticationSuccess(req:express.Request, res:express.Response)
    {
        var integrationId = req.session[ApiConstants.INTEGRATION_ID];
        var integration = new IntegrationDelegate().getSync(integrationId);
        var redirectUrl = integration.getIntegrationType() == IntegrationType.SHOP_IN_SHOP ? Urls.complete() : integration.getRedirectUrl();
        var user = req['user'];
        req.session[ApiConstants.INTEGRATION_ID] = integrationId;

        // Check if logged in member is already authorized
        var authorizationUrl = Urls.authorization() + '?response_type=code&client_id=' + integrationId + '&redirect_uri=' + redirectUrl;

        new IntegrationMemberDelegate().search({user_id: user.id, integration_id: integrationId})
            .then(
            function expertSearched(members)
            {
                if (members.length == 0)
                    res.redirect(authorizationUrl);
                else
                {
                    req.session[ApiConstants.EXPERT] = members[0];
                    res.redirect(Urls.complete());
                }
            },
            function expertSearchError(error) { res.send(500); }
        )
    }

    /* Render authorization page */
    private authorize(req:express.Request, res:express.Response)
    {
        var integrationId = parseInt(req.query[ApiConstants.INTEGRATION_ID] || req.session[ApiConstants.INTEGRATION_ID]);
        res.render('expertRegistration/authorize',
            {
                'transactionID': req['oauth2']['transactionID'],
                'user': new User(req.user.data),
                'integration': new IntegrationDelegate().get(integrationId)
            });
    }

    private expertComplete(req:express.Request, res:express.Response)
    {
        var integrationId = parseInt(req.session[ApiConstants.INTEGRATION_ID]);
        var integration = new IntegrationDelegate().getSync(integrationId);
        var userId = req['user'].id;

        new IntegrationMemberDelegate().search({'user_id': userId, 'integration_id': integrationId}, [IncludeFlag.INCLUDE_SCHEDULE_RULES])
            .then(
            function scheduleRulesFetched(members)
            {
                var member = members[0]
                var pageData = {
                    user: req['user'],
                    integration: integration,
                    "SearchNTalkUri": Config.get('SearchNTalk.uri'),
                    "schedule_rules": member[IncludeFlag.INCLUDE_SCHEDULE_RULES]
                };
                res.render('expertRegistration/complete', pageData);
            },
            function scheduleRulesFetchError(error) { res.send(500, error.getBody()); }
        )
    }

}
export = ExpertRegistrationRoute