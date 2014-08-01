import q                                                = require('q');
import _                                                = require('underscore');
import passport                                         = require('passport');
import express                                          = require('express');
import log4js                                           = require('log4js');
import accounting                                       = require('accounting');
import PricingSchemeDelegate                            = require('../../delegates/PricingSchemeDelegate');
import AuthenticationDelegate                           = require('../../delegates/AuthenticationDelegate');
import UserDelegate                                     = require('../../delegates/UserDelegate');
import IntegrationMemberDelegate                        = require('../../delegates/IntegrationMemberDelegate');
import IntegrationDelegate                              = require('../../delegates/IntegrationDelegate');
import EmailDelegate                                    = require('../../delegates/EmailDelegate');
import SMSDelegate                                      = require('../../delegates/SMSDelegate');
import CouponDelegate                                   = require('../../delegates/CouponDelegate');
import UserPhoneDelegate                                = require('../../delegates/UserPhoneDelegate');
import PhoneCallDelegate                                = require('../../delegates/PhoneCallDelegate');
import UserEducationDelegate                            = require('../../delegates/UserEducationDelegate');
import UserSkillDelegate                                = require('../../delegates/UserSkillDelegate');
import UserEmploymentDelegate                           = require('../../delegates/UserEmploymentDelegate');
import RefSkillCodeDelegate                             = require('../../delegates/SkillCodeDelegate');
import UserProfileDelegate                              = require('../../delegates/UserProfileDelegate');
import ScheduleDelegate                                 = require('../../delegates/ScheduleDelegate');
import ScheduleRuleDelegate                             = require('../../delegates/ScheduleRuleDelegate');
import VerificationCodeDelegate                         = require('../../delegates/VerificationCodeDelegate');
import MysqlDelegate                                    = require('../../delegates/MysqlDelegate');
import UserUrlDelegate                                  = require('../../delegates/UserUrlDelegate');
import TransactionDelegate                              = require('../../delegates/TransactionDelegate');
import TransactionLineDelegate                          = require('../../delegates/TransactionLineDelegate');
import ExpertiseDelegate                                = require('../../delegates/ExpertiseDelegate');
import WidgetDelegate                                   = require('../../delegates/WidgetDelegate');
import MoneyUnit                                        = require('../../enums/MoneyUnit');
import TransactionType                                  = require('../../enums/TransactionType');
import ItemType                                         = require('../../enums/ItemType');
import User                                             = require('../../models/User');
import IntegrationMember                                = require('../../models/IntegrationMember');
import Integration                                      = require('../../models/Integration');
import Coupon                                           = require('../../models/Coupon');
import UserPhone                                        = require('../../models/UserPhone');
import PhoneCall                                        = require('../../models/PhoneCall');
import UserProfile                                      = require('../../models/UserProfile');
import Transaction                                      = require('../../models/Transaction');
import TransactionLine                                  = require('../../models/TransactionLine');
import Schedule                                         = require('../../models/Schedule');
import ScheduleRule                                     = require('../../models/ScheduleRule');
import CronRule                                         = require('../../models/CronRule');
import PricingScheme                                    = require('../../models/PricingScheme');
import Expertise                                        = require('../../models/Expertise');
import UserSkill                                        = require('../../models/UserSkill');
import IntegrationMemberRole                            = require('../../enums/IntegrationMemberRole');
import ApiConstants                                     = require('../../enums/ApiConstants');
import SmsTemplate                                      = require('../../enums/SmsTemplate');
import CallStatus                                       = require('../../enums/CallStatus');
import IndustryCodes                                    = require('../../enums/IndustryCode');
import Utils                                            = require('../../common/Utils');
import Formatter                                        = require('../../common/Formatter');
import Config                                           = require('../../common/Config');
import PayZippyProvider                                 = require('../../providers/PayZippyProvider');
import CallFlowSessionData                              = require('../../routes/callFlow/SessionData');
import ExpertRegistrationSessionData                    = require('../../routes/expertRegistration/SessionData');

import Middleware                                       = require('./Middleware');
import Urls                                             = require('./Urls');
import SessionData                                      = require('./SessionData');

class DashboardRoute
{
    private static PAGE_HOME:string = 'dashboard/home';
    private static PAGE_SNS:string = 'dashboard/sns';
    private static PAGE_FORGOT_PASSWORD:string = 'dashboard/forgotPassword';
    private static PAGE_MOBILE_VERIFICATION:string = 'dashboard/mobileVerification';
    private static PAGE_DASHBOARD:string = 'dashboard/dashboard';
    private static PAGE_INTEGRATION:string = 'dashboard/integration';
    private static PAGE_PROFILE:string = 'dashboard/userProfile';
    private static PAGE_PAYMENTS:string = 'dashboard/payment';
    private static PAGE_ACCOUNT_VERIFICATION:string = 'dashboard/accountVerification';
    private static PAGE_SETTING_PHONE:string = 'dashboard/userSettingPhone';
    private static PAGE_SETTING_SCHEDULE:string = 'dashboard/userSettingSchedule';
    private static PAGE_SETTING_PASSWORD:string = 'dashboard/userSettingPassword';
    private static PAGE_WIDGET_CREATOR:string = 'dashboard/widgetCreator';

    private integrationMemberDelegate = new IntegrationMemberDelegate();
    private integrationDelegate = new IntegrationDelegate();
    private userDelegate = new UserDelegate();
    private verificationCodeDelegate = new VerificationCodeDelegate();
    private couponDelegate = new CouponDelegate();
    private scheduleDelegate = new ScheduleDelegate();
    private scheduleRuleDelegate = new ScheduleRuleDelegate();
    private pricingSchemeDelegate = new PricingSchemeDelegate();
    private userPhoneDelegate = new UserPhoneDelegate();
    private userProfileDelegate = new UserProfileDelegate();
    private expertiseDelegate = new ExpertiseDelegate();
    private logger = log4js.getLogger(Utils.getClassName(this));

    constructor(app, secureApp)
    {
        // Pages
        app.get(Urls.index(), AuthenticationDelegate.checkLogin({failureRedirect: Urls.home()}), this.dashboard.bind(this));
        app.get(Urls.home(), this.home.bind(this));
        app.get(Urls.sns(), this.sns.bind(this));
        app.get(Urls.forgotPassword(), this.forgotPassword.bind(this));
        app.get(Urls.mobileVerification(), AuthenticationDelegate.checkLogin({failureRedirect: Urls.index(), setReturnTo: true}), this.verifyMobile.bind(this));

        // Dashboard pages
        app.get(Urls.dashboard(), AuthenticationDelegate.checkLogin({setReturnTo: true}), this.dashboard.bind(this));
        app.get(Urls.integration(), AuthenticationDelegate.checkLogin({setReturnTo: true}), this.integration.bind(this));
        app.get(Urls.userProfile(), this.userProfile.bind(this));
        app.get(Urls.payments(), AuthenticationDelegate.checkLogin({setReturnTo: true}), this.userPayments.bind(this));
        app.get(Urls.userSettingPhone(), Middleware.allowOnlyMe, this.settingPhone.bind(this));
        app.get(Urls.userSettingSchedule(), Middleware.allowOnlyMe, this.settingSchedule.bind(this));
        app.get(Urls.userSettingPassword(), Middleware.allowOnlyMe, this.settingPassword.bind(this));

        app.get(Urls.emailAccountVerification(), this.emailAccountVerification.bind(this));
        app.get(Urls.widgetCreator(), this.widgetCreator.bind(this));
    }

    private sns(req:express.Request, res:express.Response)
    {
        var self = this;
        var sessionData = new SessionData(req);
        var integrationId = parseInt(req.params[ApiConstants.INTEGRATION_ID]);

        var searchParameters = {};
        if (req.query[ApiConstants.PRICE_RANGE])
            searchParameters[ApiConstants.PRICE_RANGE] = _.map((req.query[ApiConstants.PRICE_RANGE]).split(','), function (value:string) { return parseInt(value) });
        if (req.query[ApiConstants.EXPERIENCE_RANGE])
            searchParameters[ApiConstants.EXPERIENCE_RANGE] = _.map((req.query[ApiConstants.EXPERIENCE_RANGE]).split(','), function (value:string) { return parseInt(value) });
        if (req.query[ApiConstants.USER_SKILL])
            searchParameters[ApiConstants.USER_SKILL] = (req.query[ApiConstants.USER_SKILL]).split(',')
        if (req.query[ApiConstants.AVAILIBILITY])
            searchParameters[ApiConstants.AVAILIBILITY] = req.query[ApiConstants.AVAILIBILITY] == "true" ? true : false;

        q.all([
            self.integrationDelegate.get(integrationId),
            self.integrationMemberDelegate.search({'integration_id': integrationId, 'role': IntegrationMemberRole.Expert})
        ])
            .then(
            function detailsFetched(...args)
            {
                var integration = args[0][0];
                var members = args[0][1];
                var uniqueUserIds:number[] = _.uniq(_.pluck(members, IntegrationMember.COL_USER_ID));

                var foreignKeys = _.map(_.keys(req.query), function(filter:string)
                {
                    switch(filter)
                    {
                        case ApiConstants.PRICE_RANGE: return User.FK_USER_PRICING_SCHEME;
                        case ApiConstants.USER_SKILL: return User.FK_USER_SKILL;
                        default: return null;
                    }
                });
                return [integration, self.userDelegate.search(Utils.createSimpleObject(User.COL_ID, uniqueUserIds), null, foreignKeys.concat(User.FK_USER_PROFILE))];
            })
            .spread(
            function expertDetailsFetched(integration, ...args)
            {
                var pageData = _.extend(sessionData.getData(), {
                    integration: integration,
                    experts: self.applySearchParameters(searchParameters, args[0]),
                    searchParameters: searchParameters || {}
                });

                res.render(DashboardRoute.PAGE_SNS, pageData);
            })
            .fail(
            function integrationFetchError(error)
            {
                res.render('500', {error: error});
            })
    }

    applySearchParameters(searchParameters:Object, experts:User[]):q.Promise<User[]>
    {
        var keys = _.keys(searchParameters);
        var invalidIndex = [];
        var self = this;

        _.each(keys, function (key)
        {
            switch (key)
            {
                case ApiConstants.PRICE_RANGE:
                    _.each(experts, function (expert:User, index)
                    {
                        expert.getPricingScheme()
                            .then(
                            function pricingSchemeFetched(schemes:PricingScheme[])
                            {
                                if (!Utils.isNullOrEmpty(schemes))
                                {
                                    var pricing:PricingScheme = schemes[0];
                                    var perMinChargeInRupees = pricing.getChargingRate();

                                    if (pricing.getPulseRate() > 1)
                                        perMinChargeInRupees = perMinChargeInRupees / pricing.getPulseRate();
                                    if (pricing.getUnit() == MoneyUnit.DOLLAR)
                                        perMinChargeInRupees *= 60;

                                    if (perMinChargeInRupees < searchParameters[key][0] || perMinChargeInRupees > searchParameters[key][1])
                                        invalidIndex.push(index);
                                }
                                if (Utils.isNullOrEmpty(schemes) && searchParameters[key][0] > 0) //don't display experts with no pricing scheme when search price range > 0
                                    invalidIndex.push(index);
                            });
                    });
                    break;

                case ApiConstants.EXPERIENCE_RANGE:
                    break;

                case ApiConstants.AVAILIBILITY:
                    _.each(experts, function (expert:User, index)
                    {
                        self.scheduleDelegate.getSchedulesForUser(expert.getId())
                            .then(
                            function scheduleFetched(schedules:Schedule[])
                            {
                                if (!expert.isCurrentlyAvailable(schedules))
                                    invalidIndex.push(index);
                            });
                    });
                    break;

                case ApiConstants.USER_SKILL:
                    _.each(experts, function (expert:User, index)
                    {
                        expert.getSkill()
                            .then(
                            function skillsFetched(skills:UserSkill[])
                            {
                                var expertSkills = _.map(skills, function (skill:any)
                                {
                                    return skill.skill.skill;
                                });

                                var isValid = false;
                                _.each(searchParameters[key], function (skill)
                                {
                                    if (_.indexOf(expertSkills, skill) != -1)
                                        isValid = true;
                                })

                                if (!isValid)
                                    invalidIndex.push(index);
                            });

                    });
                    break;
            }
        });
        _.each(_.uniq(invalidIndex), function (index)
        {
            delete experts[index];
        })
        return _.compact(experts);
    }

    private home(req:express.Request, res:express.Response)
    {
        var sessionData = new SessionData(req);

        var pageData = _.extend(sessionData.getData(), {
            messages: req.flash()
        });

        res.render(DashboardRoute.PAGE_HOME, pageData);
    }

    /* Forgot Password page */
    private forgotPassword(req:express.Request, res:express.Response)
    {
        var code:string = req.query[ApiConstants.CODE];

        var pageData = {
            code: code,
            messages: req.flash()
        };

        res.render(DashboardRoute.PAGE_FORGOT_PASSWORD, pageData);
    }

    /**
     * Mobile Verification page
     * The page has a contextual header so it can be used in multiple places
     */
    private verifyMobile(req:express.Request, res:express.Response)
    {
        this.userPhoneDelegate.find(Utils.createSimpleObject(UserPhone.COL_USER_ID, req[ApiConstants.USER].id))
            .then(
            function renderPage(numbers:UserPhone[])
            {
                var sessionData = new SessionData(req);

                var pageData = _.extend(sessionData.getData(), {
                    userPhones: numbers,
                    messages: req.flash()
                });
                res.render(DashboardRoute.PAGE_MOBILE_VERIFICATION, pageData);
            })
            .fail(
            function handleError(error)
            {
                res.render('500', {error: error.message});
            });
    }

    private dashboard(req:express.Request, res:express.Response)
    {
        var self = this;
        var sessionData = new SessionData(req);
        var pageData = sessionData.getData();
        var userId = parseInt(req[ApiConstants.USER].id);

        q.all([
            self.expertiseDelegate.search(Utils.createSimpleObject(Expertise.COL_USER_ID, userId))
        ])
            .then(
            function dashboardDetailsFetched(...args)
            {
                res.render(DashboardRoute.PAGE_DASHBOARD, pageData);
            })
            .fail(
            function handleError(error)
            {
                res.render('500', {error: error.message});
            });
    }

    /* Integration page */
    private integration(req:express.Request, res:express.Response)
    {
        var self = this;
        var sessionData = new SessionData(req);
        var selectedIntegrationId = parseInt(req.query[ApiConstants.INTEGRATION_ID]);
        var createIntegration = req.query[ApiConstants.CREATE_INTEGRATION] == 'true';

        // 1. Get all member entries associated with the user
        // 2. Get coupons and members for the selected integration
        this.integrationMemberDelegate.search({user_id: sessionData.getLoggedInUser().getId()}, null, [IntegrationMember.FK_INTEGRATION])
            .then(
            function integrationsFetched(integrationMembers:IntegrationMember[])
            {
                if (!Utils.isNullOrEmpty(integrationMembers))
                {
                    var integrationId = selectedIntegrationId || integrationMembers[0].getIntegrationId();

                    return [integrationId, integrationMembers, q.all([
                        self.integrationMemberDelegate.search({integration_id: integrationId}, IntegrationMember.DASHBOARD_FIELDS, [IntegrationMember.FK_USER]),
                        self.verificationCodeDelegate.getInvitationCodes(integrationId),
                        self.couponDelegate.search({integration_id: integrationId}, Coupon.DASHBOARD_FIELDS, [Coupon.FK_COUPON_EXPERT])
                    ])];
                }
                else
                    return [null, [], [
                        [],
                        [],
                        [],
                        {}
                    ]];
            })
            .spread(
            function integrationDetailsFetched(integrationId:number, members:IntegrationMember[], ...results)
            {
                self.logger.debug('Data fetched for network page');

                var integrationMembers = results[0][0];
                var invitedMembers = [].concat(_.values(results[0][1]));
                var coupons = results[0][2] || [];

                var isPartOfDefaultNetwork = !Utils.isNullOrEmpty(_.findWhere(members, Utils.createSimpleObject(IntegrationMember.COL_INTEGRATION_ID, Config.get(Config.DEFAULT_NETWORK_ID))));
                integrationMembers = integrationMembers.concat(_.map(invitedMembers, function (invited)
                {
                    var invitedMember = new IntegrationMember(invited);
                    invitedMember.setUser(invited['user']);
                    return invitedMember;
                }));

                var pageData = _.extend(sessionData.getData(), {
                    'members': members,
                    'selectedMember': _.findWhere(members, {'integration_id': integrationId}),
                    'integrationMembers': integrationMembers,
                    'coupons': coupons,
                    integration: self.integrationDelegate.getSync(integrationId),
                    createIntegration: createIntegration,
                    isPartOfDefaultNetwork: isPartOfDefaultNetwork
                });

                res.render(DashboardRoute.PAGE_INTEGRATION, pageData);
            })
            .fail(
            function handleFailure(error)
            {
                res.render('500', {error: error.message});
            });
    }

    /* Member Profile page */
    private userProfile(req:express.Request, res:express.Response)
    {
        var self = this;
        var userId = parseInt(req.params[ApiConstants.USER_ID]);
        var mode = req.query[ApiConstants.MODE];
        var sessionData = new SessionData(req);
        var member:IntegrationMember;
        var loggedInUser = sessionData.getLoggedInUser();

        self.userProfileDelegate.find(Utils.createSimpleObject(UserProfile.COL_USER_ID, userId))
            .then(
            function profileFetched(userProfile:UserProfile)
            {
                var profileInfoTasks = [self.userDelegate.get(userId, null, [User.FK_USER_SKILL, User.FK_USER_EDUCATION, User.FK_USER_EMPLOYMENT])];

                if (!Utils.isNullOrEmpty(userProfile) && userProfile.getId())
                    profileInfoTasks = profileInfoTasks.concat([
                        self.expertiseDelegate.search(Utils.createSimpleObject(Expertise.COL_USER_ID, userId), null, [Expertise.FK_EXPERTISE_SKILL])
                    ]);

                return [userProfile, q.all(profileInfoTasks)];
            })
            .spread(
            function userDetailsFetched(userProfile, ...args)
            {
                var user = args[0][0];
                var expertise = args[0][4] || [];

                var isEditable = loggedInUser ? loggedInUser.getId() == user.getId() : false;

                if (mode == ApiConstants.PUBLIC_MODE)
                    isEditable = false;

                var profileId = userProfile ? userProfile.getId() : null;

                var pageData = _.extend(sessionData.getData(), {
                    'profileId': profileId,
                    'member': member,
                    'user': user,
                    //'userSkill': _.sortBy(userSkill, function (skill) { return skill['skill_name'].length; }),
                    'userProfile': userProfile,
                    'userExpertise': expertise,
                    'messages': req.flash(),
                    'isEditable': isEditable
                });
                res.render(DashboardRoute.PAGE_PROFILE, pageData);
            },
            function memberDetailsFetchError(error)
            {
                res.render('500', {error: error});
            });
    }

    userPayments(req:express.Request, res:express.Response)
    {
        var sessionData = new SessionData(req);
        var pageData = _.extend(sessionData.getData(), {

        });
        res.render(DashboardRoute.PAGE_PAYMENTS, pageData);
    }

    settingPhone(req:express.Request, res:express.Response)
    {
        var self = this;
        var userId:number = parseInt(req.params[ApiConstants.USER_ID]);
        var sessionData = new SessionData(req);

        q.all([
            self.userPhoneDelegate.search(Utils.createSimpleObject(UserPhone.COL_USER_ID, userId))
        ])
            .then(function detailsFetched(...args)
            {
                var userPhone:UserPhone[] = args[0][2];

                var pageData = _.extend(sessionData.getData(), {
                    userPhone: userPhone
                });

                res.render(DashboardRoute.PAGE_SETTING_PHONE, pageData);
            })
            .fail(
            function (error)
            {
                res.render('500', error.message)
            });
    }

    settingSchedule(req:express.Request, res:express.Response)
    {
        var self = this;
        var userId:number = parseInt(req.params[ApiConstants.USER_ID]);
        var sessionData = new SessionData(req);

        q.all([
            self.scheduleRuleDelegate.getRulesByUser(userId),
            self.pricingSchemeDelegate.search(Utils.createSimpleObject(PricingScheme.COL_USER_ID, userId))
        ])
            .then(function detailsFetched(...args)
            {
                var rules:ScheduleRule[] = [].concat(args[0][0]);
                var pricingSchemes:PricingScheme[] = args[0][1];

                _.each(rules || [], function (rule:ScheduleRule)
                {
                    rule['values'] = CronRule.getValues(rule.getCronRule())
                });

                var pageData = _.extend(sessionData.getData(), {
                    rules: rules || [],
                    scheme: pricingSchemes ? pricingSchemes[0] : new PricingScheme()
                });

                res.render(DashboardRoute.PAGE_SETTING_SCHEDULE, pageData);
            })
            .fail(
            function (error)
            {
                res.render('500', error.message)
            });
    }

    settingPassword(req:express.Request, res:express.Response)
    {
        var sessionData = new SessionData(req);
        var pageData = sessionData.getData();
        res.render(DashboardRoute.PAGE_SETTING_PASSWORD, pageData);
    }

    private emailAccountVerification(req, res:express.Response)
    {
        var self = this;
        var code:string = req.query[ApiConstants.CODE];
        var email:string = req.query[ApiConstants.EMAIL];

        if (Utils.isNullOrEmpty(code) || Utils.isNullOrEmpty(email))
            return res.render('500', {error: 'Invalid code or email'});

        this.verificationCodeDelegate.verifyEmailVerificationCode(code, email)
            .then(
            function verified(result:boolean):any
            {
                if (result)
                {
                    var userActivationUpdate = {};
                    userActivationUpdate[User.COL_ACTIVE] =
                        userActivationUpdate[User.COL_EMAIL_VERIFIED] = true;
                    return self.userDelegate.update(Utils.createSimpleObject(User.COL_EMAIL, email), userActivationUpdate);
                }
                else
                    return res.render('500', {error: 'Account verification failed. Invalid code or email'});
            })
            .then(
            function userActivated()
            {
                if (req.isAuthenticated() && req[ApiConstants.USER][User.COL_EMAIL] === email)
                {
                    req[ApiConstants.USER][User.COL_ACTIVE] = true;
                    req[ApiConstants.USER][User.COL_EMAIL_VERIFIED] = true;
                }
                return res.render(DashboardRoute.PAGE_ACCOUNT_VERIFICATION);
            })
            .then(
            function responseSent()
            {
                return self.verificationCodeDelegate.deleteEmailVerificationCode(email);
            })
            .fail(
            function verificationFailed(error)
            {
                res.render('500', {error: error.message});
            });
    }

    private widgetCreator(req:express.Request, res:express.Response)
    {
        var sessionData = new SessionData(req);
        var pageData = _.extend(sessionData.getData(), {
            'allowedVerbs': WidgetDelegate.ALLOWED_VERBS
        });
        res.render(DashboardRoute.PAGE_WIDGET_CREATOR, pageData);
    }
}

export = DashboardRoute