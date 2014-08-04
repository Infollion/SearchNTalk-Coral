///<reference path='../_references.d.ts'/>
import _                                                            = require('underscore');
import url                                                          = require('url');
import cheerio                                                      = require('cheerio');
import fs                                                           = require('fs');
import log4js                                                       = require('log4js');
import path                                                         = require('path');
import q                                                            = require('q');
import nodemailer                                                   = require('nodemailer');
import watch                                                        = require('watch');
import User                                                         = require('../models/User')
import Integration                                                  = require('../models/Integration')
import IntegrationMember                                            = require('../models/IntegrationMember')
import Schedule                                                     = require('../models/Schedule');
import PhoneCall                                                    = require('../models/PhoneCall');
import ApiConstants                                                 = require('../enums/ApiConstants');
import CallStatus                                                   = require('../enums/CallStatus');
import IntegrationMemberRole                                        = require('../enums/IntegrationMemberRole');
import ApiUrlDelegate                                               = require('../delegates/ApiUrlDelegate');
import UserDelegate                                                 = require('../delegates/UserDelegate');
import IntegrationDelegate                                          = require('../delegates/IntegrationDelegate');
import IntegrationMemberDelegate                                    = require('../delegates/IntegrationMemberDelegate');
import VerificationCodeDelegate                                     = require('../delegates/VerificationCodeDelegate');
import FileWatcherDelegate                                          = require('../delegates/FileWatcherDelegate');
import PhoneCallDelegate                                            = require('../delegates/PhoneCallDelegate');
import TimezoneDelegate                                             = require('../delegates/TimezoneDelegate');
import Utils                                                        = require('../common/Utils');
import Config                                                       = require('../common/Config');
import Formatter                                                    = require('../common/Formatter');
import ExpertRegistrationUrls                                       = require('../routes/expertRegistration/Urls');
import DashboardUrls                                                = require('../routes/dashboard/Urls');
import CallFlowUrls                                                 = require('../routes/callFlow/Urls');

/*
 Delegate class for managing email
 1. Queue new email
 2. Check status of emails
 3. Search emails
 */
class EmailDelegate
{
    private static EMAIL_TEST:string = 'EMAIL_TEST';
    private static EMAIL_PASSWORD_RESET:string = 'EMAIL_PASSWORD_RESET';
    private static EMAIL_EXPERT_INVITE:string = 'EMAIL_EXPERT_INVITE';
    private static EMAIL_MEMBER_ADDED:string = 'EMAIL_MEMBER_ADDED';
    private static EMAIL_INTEGRATION_ADDED:string = 'EMAIL_INTEGRATION_ADDED';
    private static EMAIL_EXPERT_WELCOME:string = 'EMAIL_EXPERT_WELCOME';
    private static EMAIL_EXPERT_REMIND_MOBILE_VERIFICATION:string = 'EMAIL_EXPERT_REMIND_MOBILE_VERIFICATION';
    private static EMAIL_EXPERT_SCHEDULING:string = 'EMAIL_EXPERT_SCHEDULING';
    private static EMAIL_EXPERT_SCHEDULED:string = 'EMAIL_EXPERT_SCHEDULED';
    private static EMAIL_EXPERT_CALL_REMINDER:string = 'EMAIL_EXPERT_CALL_REMINDER';
    private static EMAIL_NEW_SLOTS_TO_EXPERT:string = 'EMAIL_NEW_SLOTS_TO_EXPERT';
    private static EMAIL_ACCOUNT_VERIFICATION:string = 'EMAIL_ACCOUNT_VERIFICATION';
    private static EMAIL_USER_CALL_REMINDER:string = 'EMAIL_USER_CALL_REMINDER';
    private static EMAIL_USER_SCHEDULED:string = 'EMAIL_USER_SCHEDULED';
    private static EMAIL_USER_AGENDA_FAIL:string = 'EMAIL_USER_AGENDA_FAIL';
    private static EMAIL_SUGGESTED_TIME_TO_CALLER:string = 'EMAIL_SUGGESTED_TIME_TO_CALLER';
    private static EMAIL_EXPERT_REGISTRATION_SUCCESS:string = 'EMAIL_EXPERT_REGISTRATION_SUCCESS';
    private static EMAIL_USER_ACCOUNT_INCOMPLETE_REMINDER:string = 'EMAIL_USER_ACCOUNT_INCOMPLETE_REMINDER';

    private static templateCache:{[templateNameAndLocale:string]:{bodyTemplate:Function; subjectTemplate:Function}} = {};
    private static transport:nodemailer.Transport;
    private static logger:log4js.Logger = log4js.getLogger('EmailDelegate');
    private phoneCallDelegate;
    private integrationMemberDelegate = new IntegrationMemberDelegate();
    private userDelegate = new UserDelegate();
    private timezoneDelegate = new TimezoneDelegate();

    constructor()
    {
        var PhoneCallDelegate = require('../delegates/PhoneCallDelegate');
        this.phoneCallDelegate = new PhoneCallDelegate();

        if (Utils.isNullOrEmpty(EmailDelegate.transport))
            EmailDelegate.transport = nodemailer.createTransport('SMTP', {
                service: 'SendGrid',
                auth: {
                    user: 'infollion',
                    pass: 'infollion123'
                }
            });
    }

    /* Static constructor workaround */
    private static ctor = (() =>
    {
        new FileWatcherDelegate(Config.get(Config.EMAIL_TEMPLATE_BASE_DIR), [new RegExp('\.html$')],
            function initHandler(files)
            {
                _.each(files, function (fileName) { EmailDelegate.readFileAndCache(fileName); });
            },
            EmailDelegate.readFileAndCache,
            EmailDelegate.readFileAndCache);
    })();

    private static readFileAndCache(filePath)
    {
        var fileName = filePath.substring(filePath.lastIndexOf(path.sep) + 1);
        var extension = fileName.substring(fileName.lastIndexOf('.') + 1);
        if (extension != 'html') return;

        var fileNameWithoutExtension = fileName.substring(0, fileName.lastIndexOf('.'));
        fs.readFile(filePath, 'utf8', function (err, data)
        {
            if (data)
            {
                EmailDelegate.templateCache[fileNameWithoutExtension.toUpperCase()] =
                {
                    'bodyTemplate': _.template(data),
                    'subjectTemplate': _.template(cheerio.load(data)('title').text())
                };
                EmailDelegate.logger.debug('Email template updated: ' + fileNameWithoutExtension.toUpperCase());
            }
        });
    }

    private composeAndSend(template:string, to:string, emailData:Object, from?:string, replyTo?:string):q.Promise<any>
    {
        var deferred = q.defer<any>();

        emailData["email_cdn_base_uri"] = Config.get(Config.EMAIL_CDN_BASE_URI);
        from = from || 'SearchNTalk.com\<contact@searchntalk.com\>';
        replyTo = replyTo || 'no-reply\<no-reply@searchntalk.com\>';

        try
        {
            var body:string = this.getEmailBody(template, emailData);
            var subject:string = this.getEmailSubject(template, emailData);
        } catch (e)
        {
            EmailDelegate.logger.error('Invalid email template: ' + template);
            deferred.reject("Invalid email data");
            return null;
        }

        EmailDelegate.transport.sendMail(
            {
                from: from,
                to: to,
                replyTo: replyTo,
                subject: subject,
                html: body,
                forceEmbeddedImages: true
            },
            function emailSent(error:Error, response:any)
            {
                if (error)
                {
                    //TODO cache email and try again in sometime
                    EmailDelegate.logger.info('Error in sending Email to: %s, error: %s', to, JSON.stringify(error));
                    deferred.reject(error);
                }
                else
                {
                    EmailDelegate.logger.info('Email sent to:' + to);
                    deferred.resolve(response);
                }
            }
        );

        return deferred.promise;
    }

    getEmailBody(template:string, emailData:Object):string
    {
        try
        {
            var bodyTemplate:Function = EmailDelegate.templateCache[template].bodyTemplate;
            return bodyTemplate(emailData);
        }
        catch (err)
        {
            EmailDelegate.logger.error("Couldn't generate email body for (template %s, data: %s), Error:" + err, template, JSON.stringify(emailData));
            throw(err);
        }
    }

    getEmailSubject(template:string, emailData:Object):string
    {
        try
        {
            var subjectTemplate:Function = EmailDelegate.templateCache[template].subjectTemplate;
            return subjectTemplate(emailData);
        }
        catch (err)
        {
            EmailDelegate.logger.error("Couldn't generate email subject for (template %s, data: %s), Error: %s", template, emailData, err);
            throw(err);
        }
    }

    sendCallRequestRejectedEmail(call:number, reason:string):q.Promise<any>;
    sendCallRequestRejectedEmail(call:PhoneCall, reason:string):q.Promise<any>;
    sendCallRequestRejectedEmail(call:any, reason:string):q.Promise<any>
    {
        var self = this;

        if (Utils.getObjectType(call) == 'Number')
            return self.phoneCallDelegate.get(call, null, [PhoneCall.FK_PHONE_CALL_CALLER])
                .then(
                function (fetchedCall:PhoneCall)
                {
                    return self.sendCallRequestRejectedEmail(fetchedCall, reason);
                });

        return call.getUser()
            .then(
            function userFetched(user:User)
            {
                return self.composeAndSend(EmailDelegate.EMAIL_USER_AGENDA_FAIL, user.getEmail(), {call: call});
            });
    }

    sendNewCallRequestNotifications(call:number, appointments:number[], duration:number, caller:User):q.Promise<any>;
    sendNewCallRequestNotifications(call:PhoneCall, appointments:number[], duration:number, caller:User):q.Promise<any>;
    sendNewCallRequestNotifications(call:any, appointments:number[], duration:number, caller:User):q.Promise<any>
    {
        var self = this;

        if (Utils.getObjectType(call) == 'Number')
            return self.phoneCallDelegate.get(call, null, [PhoneCall.FK_PHONE_CALL_EXPERT])
                .then(
                function (fetchedCall:PhoneCall)
                {
                    return self.sendNewCallRequestNotifications(fetchedCall, appointments, duration, caller);
                });

        var VerificationCodeDelegate:any = require('../delegates/VerificationCodeDelegate');
        var verificationCodeDelegate = new VerificationCodeDelegate();

        return call.getExpertUser()
            .then(
            function expertFetched(expertUser:User)
            {
                return verificationCodeDelegate.createAppointmentAcceptCode(call, appointments, caller.getId())
                    .then(
                    function invitationAcceptCodeCreated(code:string)
                    {
                        var schedulingUrl:string = CallFlowUrls.scheduling(call.getId(), Config.get(Config.DASHBOARD_URI));

                        var emailData = {
                            call: call,
                            caller: caller,
                            duration: duration,
                            appointments: appointments,
                            suggestTimeUrl: Utils.addQueryToUrl(CallFlowUrls.scheduling(call.getId(), Config.get(Config.DASHBOARD_URI)), Utils.createSimpleObject(ApiConstants.CODE, code)),
                            rejectUrl: Utils.addQueryToUrl(CallFlowUrls.scheduling(call.getId(), Config.get(Config.DASHBOARD_URI)), Utils.createSimpleObject(ApiConstants.CODE, code)),
                            appointmentUrls: _.map(appointments, function (startTime)
                            {
                                var query = {};
                                query[ApiConstants.CODE] = code;
                                query[ApiConstants.START_TIME] = startTime;

                                return Utils.addQueryToUrl(schedulingUrl, query);
                            }),
                            expertGmtOffset: self.timezoneDelegate.get(call.getExpertUser().getTimezone())['gmt_offset'] * 1000
                        };

                        return self.composeAndSend(EmailDelegate.EMAIL_EXPERT_SCHEDULING, expertUser.getEmail(), emailData);
                    });
            });
    }

    sendSchedulingCompleteEmail(call:number, appointment:number):q.Promise<any>;
    sendSchedulingCompleteEmail(call:PhoneCall, appointment:number):q.Promise<any>;
    sendSchedulingCompleteEmail(call:any, appointment:number):q.Promise<any>
    {
        var self = this;

        if (Utils.getObjectType(call) == 'Number')
            return self.phoneCallDelegate.get(call, null, [PhoneCall.FK_PHONE_CALL_EXPERT, PhoneCall.FK_PHONE_CALL_CALLER])
                .then(
                function (fetchedCall:PhoneCall)
                {
                    return self.sendSchedulingCompleteEmail(fetchedCall, appointment);
                });

        return q.all([
            call.getExpertUser(),
            call.getUser()
        ])
        .then(
            function callDetailsFetched(...args)
            {
                var expertUser:User = args[0][0];
                var user:User = args[0][1];

                var emailData = {
                    call: call,
                    userGmtOffset: self.timezoneDelegate.get(user.getTimezone())['gmt_offset'] * 1000,
                    expertGmtOffset: self.timezoneDelegate.get(expertUser.getTimezone())['gmt_offset'] * 1000
                };

                return q.all([
                    self.composeAndSend(EmailDelegate.EMAIL_EXPERT_SCHEDULED, expertUser.getEmail(), emailData),
                    self.composeAndSend(EmailDelegate.EMAIL_USER_SCHEDULED, user.getEmail(), emailData)
                ]);
            });
    }

    sendSuggestedAppointmentToCaller(call:number, appointment:number, expertUserId:number):q.Promise<any>;
    sendSuggestedAppointmentToCaller(call:PhoneCall, appointment:number, expertUserId:number):q.Promise<any>;
    sendSuggestedAppointmentToCaller(call:any, appointment:number, expertUserId:number):q.Promise<any>
    {
        var self = this;

        if (Utils.getObjectType(call) == 'Number')
            return self.phoneCallDelegate.get(call, null, [PhoneCall.FK_PHONE_CALL_CALLER])
                .then(
                function (fetchedCall:PhoneCall)
                {
                    return self.sendSuggestedAppointmentToCaller(fetchedCall, appointment, expertUserId);
                });

        var VerificationCodeDelegate:any = require('../delegates/VerificationCodeDelegate');
        var verificationCodeDelegate = new VerificationCodeDelegate();


        return call.getUser()
            .then(
            function callUserFetched(user:User)
            {
                return verificationCodeDelegate.createAppointmentAcceptCode(call, [appointment], expertUserId)
                    .then(
                    function invitationAcceptCodeCreated(code:string)
                    {
                        var schedulingUrl:string = CallFlowUrls.scheduling(call.getId(), Config.get(Config.DASHBOARD_URI));
                        var query = {};
                        query[ApiConstants.CODE] = code;
                        query[ApiConstants.START_TIME] = appointment;

                        var appointmentUrl = Utils.addQueryToUrl(schedulingUrl, query);

                        var emailData = {
                            call: call,
                            acceptCode: code,
                            appointment: appointment,
                            appointmentUrl: appointmentUrl,
                            suggestTimeUrl: Utils.addQueryToUrl(CallFlowUrls.scheduling(call.getId(), Config.get(Config.DASHBOARD_URI)), Utils.createSimpleObject(ApiConstants.CODE, code)),
                            userGmtOffset: self.timezoneDelegate.get(call.getUser().getTimezone())['gmt_offset'] * 1000
                        };

                        return q.all([
                            self.composeAndSend(EmailDelegate.EMAIL_SUGGESTED_TIME_TO_CALLER, user.getEmail(), emailData)
                        ]);
                    });
            });

    }

    sendNewTimeSlotsToExpert(call:number, appointments:number[], callerUserId:number):q.Promise<any>;
    sendNewTimeSlotsToExpert(call:PhoneCall, appointments:number[], callerUserId:number):q.Promise<any>;
    sendNewTimeSlotsToExpert(call:any, appointments:number[], callerUserId:number):q.Promise<any>
    {
        var self = this;

        if (Utils.getObjectType(appointments) == 'Number')
            appointments = [].concat(appointments);

        if (Utils.getObjectType(call) == 'Number')
            return self.phoneCallDelegate.get(call, null, [PhoneCall.FK_PHONE_CALL_EXPERT])
                .then(
                function (fetchedCall:PhoneCall)
                {
                    return self.sendNewTimeSlotsToExpert(fetchedCall, appointments, callerUserId);
                });

        var VerificationCodeDelegate:any = require('../delegates/VerificationCodeDelegate');
        var verificationCodeDelegate = new VerificationCodeDelegate();

        return call.getExpertUser()
            .then(
            function expertFetched(expertUser:User)
            {
                return verificationCodeDelegate.createAppointmentAcceptCode(call, appointments, callerUserId)
                    .then(
                    function invitationAcceptCodeCreated(code:string)
                    {
                        var schedulingUrl:string = CallFlowUrls.scheduling(call.getId(), Config.get(Config.DASHBOARD_URI));
                        var emailData = {
                            call: call,
                            acceptCode: code,
                            appointments: appointments,
                            rejectUrl: Utils.addQueryToUrl(CallFlowUrls.scheduling(call.getId(), Config.get(Config.DASHBOARD_URI)), Utils.createSimpleObject(ApiConstants.CODE, code)),
                            appointmentUrls: _.map(appointments, function (startTime)
                            {
                                var query = {};
                                query[ApiConstants.CODE] = code;
                                query[ApiConstants.START_TIME] = startTime;

                                return Utils.addQueryToUrl(schedulingUrl, query);
                            }),
                            expertGmtOffset: self.timezoneDelegate.get(expertUser.getTimezone())['gmt_offset'] * 1000
                        };

                        return self.composeAndSend(EmailDelegate.EMAIL_NEW_SLOTS_TO_EXPERT, expertUser.getEmail(), emailData);
                    });
            });
    }

    sendExpertInvitationEmail(integrationId:number, invitationCode:string, recipient:IntegrationMember, sender:User):q.Promise<any>
    {
        var self = this;
        var invitationUrl = ExpertRegistrationUrls.index();
        invitationUrl = url.resolve(Config.get(Config.DASHBOARD_URI), invitationUrl);

        var query = {};
        query[ApiConstants.INTEGRATION_ID] = integrationId;
        query[ApiConstants.CODE] = invitationCode;
        invitationUrl = Utils.addQueryToUrl(invitationUrl, query);

        var integration = new IntegrationDelegate().getSync(integrationId)
        var emailData = {
            integration: integration,
            invitation_url: invitationUrl,
            recipient: recipient.toJson(),
            sender: sender.toJson()
        };

        return recipient.getUser()
            .then(function userFetched(user:User)
            {
                return self.composeAndSend(EmailDelegate.EMAIL_EXPERT_INVITE, user.getEmail(), emailData, Formatter.formatUserName(sender, true));
            });
    }

    sendWelcomeEmail(integrationId:number, recipient:IntegrationMember):q.Promise<any>
    {
        var integration = new IntegrationDelegate().getSync(integrationId)
        var self = this;

        var emailData = {
            integration: integration,
            recipient: recipient.toJson()
        };

        return recipient.getUser()
            .then(function userFetched(user:User)
            {
                return self.composeAndSend(EmailDelegate.EMAIL_EXPERT_WELCOME, user.getEmail(), emailData);
            });
    }

    sendMobileVerificationReminderEmail(integrationId:number, invitationCode:string, recipient:IntegrationMember):q.Promise<any>
    {
        var self = this;
        var invitationUrl = ExpertRegistrationUrls.index();
        invitationUrl = url.resolve(Config.get(Config.DASHBOARD_URI), invitationUrl);

        var query = {};
        query[ApiConstants.INTEGRATION_ID] = integrationId;
        query[ApiConstants.CODE] = invitationCode;
        invitationUrl = Utils.addQueryToUrl(invitationUrl, query);

        var integration = new IntegrationDelegate().getSync(integrationId)

        var emailData = {
            integration: integration,
            invitation_url: invitationUrl,
            recipient: recipient.toJson()
        };

        return recipient.getUser()
            .then(
            function userFetched(user:User)
            {
                return self.composeAndSend(EmailDelegate.EMAIL_EXPERT_REMIND_MOBILE_VERIFICATION, user.getEmail(), emailData);
            });
    }

    sendCallReminderEmail(call:number):q.Promise<any>;
    sendCallReminderEmail(call:PhoneCall):q.Promise<any>;
    sendCallReminderEmail(call:any):q.Promise<any>
    {
        var self = this;

        if (Utils.getObjectType(call) == 'Number')
            return self.phoneCallDelegate.get(call, null, [PhoneCall.FK_PHONE_CALL_EXPERT, PhoneCall.FK_PHONE_CALL_CALLER]).then(function (fetchedCall:PhoneCall)
            {
                return self.sendCallReminderEmail(fetchedCall);
            });

        var integration = new IntegrationDelegate().getSync(call.getIntegrationMember().getIntegrationId());

        return q.all([
            call.getExpertUser(),
            call.getUser()
        ])
        .then(
            function callDetailsFetched(...args)
            {
                var expertUser:User = args[0][0];
                var user:User = args[0][1];

                var emailData = {
                    integration: integration,
                    call: call,
                    appointment: call.getStartTime(),
                    userGmtOffset: self.timezoneDelegate.get(call.getUser().getTimezone())['gmt_offset'] * 1000,
                    expertGmtOffset: self.timezoneDelegate.get(call.getExpertUser().getTimezone())['gmt_offset'] * 1000
                };

                return q.all([
                    self.composeAndSend(EmailDelegate.EMAIL_USER_CALL_REMINDER, user.getEmail(), emailData),
                    self.composeAndSend(EmailDelegate.EMAIL_EXPERT_CALL_REMINDER, expertUser.getEmail(), emailData)
                ]);
            });
    }

    sendCallFailureEmail(call:number):q.Promise<any>;
    sendCallFailureEmail(call:PhoneCall):q.Promise<any>;
    sendCallFailureEmail(call:any):q.Promise<any>
    {
        var self = this;

        if (Utils.getObjectType(call) == 'Number')
            return self.phoneCallDelegate.get(call).then(self.sendCallFailureEmail);

        return q.resolve('OK');//TODO[ankit] create email
    }

    sendMemberAddedEmail(member:IntegrationMember, passwordResetCode?:string):q.Promise<any>
    {
        var self = this;
        var getStartedUrl:string;

        if (!Utils.isNullOrEmpty(passwordResetCode))
        {
            getStartedUrl = url.resolve(Config.get(Config.DASHBOARD_URI), DashboardUrls.forgotPassword());
            var query = {};
            query[ApiConstants.CODE] = passwordResetCode;
            getStartedUrl = Utils.addQueryToUrl(getStartedUrl, query);
        }
        else
        {
            getStartedUrl = url.resolve(Config.get(Config.DASHBOARD_URI), DashboardUrls.integration());
            var query = {};
            query[ApiConstants.INTEGRATION_ID] = member.getIntegrationId();
            getStartedUrl = Utils.addQueryToUrl(getStartedUrl, query);
        }


        return q.all([
            member.getUser(),
            member.getIntegration()
        ])
            .then(
            function userFetched(...args)
            {
                var user:User = args[0][0];

                var emailData = {
                    member: member,
                    getStartedUrl: getStartedUrl
                };

                return self.composeAndSend(EmailDelegate.EMAIL_MEMBER_ADDED, user.getEmail(), emailData);
            });
    }

    sendAccountVerificationEmail(user:User, verificationCode:string):q.Promise<any>
    {
        var verificationUrl = url.resolve(Config.get(Config.DASHBOARD_URI), DashboardUrls.emailAccountVerification());

        var query = {};
        query[ApiConstants.CODE] = verificationCode;
        query[ApiConstants.EMAIL] = user.getEmail();
        verificationUrl = Utils.addQueryToUrl(verificationUrl, query);

        var emailData = {
            code: verificationCode,
            verificationUrl: verificationUrl
        };

        return this.composeAndSend(EmailDelegate.EMAIL_ACCOUNT_VERIFICATION, user.getEmail(), emailData);
    }

    sendPasswordResetEmail(email:string, code:string):q.Promise<any>
    {
        var passwordResetUrl = url.resolve(Config.get(Config.DASHBOARD_URI), DashboardUrls.forgotPassword());

        var query = {};
        query[ApiConstants.CODE] = code;
        passwordResetUrl = Utils.addQueryToUrl(passwordResetUrl, query);

        var emailData = {
            passwordResetUrl: passwordResetUrl
        };

        return this.composeAndSend(EmailDelegate.EMAIL_PASSWORD_RESET, email, emailData);
    }

    sendExpertRegistrationCompleteEmail(expert:IntegrationMember):q.Promise<any>
    {
        var self = this;
        var integration = new IntegrationDelegate().getSync(expert.getIntegrationId());
        var profileUrl = DashboardUrls.userProfile(expert.getUserId(), Config.get(Config.DASHBOARD_URI));
        var callHandleUrl = CallFlowUrls.callExpert(expert.getUserId(), Config.get(Config.DASHBOARD_URI));

        var emailData = {
            profileUrl: profileUrl,
            callHandleUrl: callHandleUrl,
            integration: integration,
            expert: expert
        };

        return expert.getUser()
            .then(
            function userFetched(user:User)
            {
                return self.composeAndSend(EmailDelegate.EMAIL_EXPERT_REGISTRATION_SUCCESS, user.getEmail(), emailData);
            });
    }

    sendTestEmail(to:string = 'nishant.kyal@gmail.com', data:Object = {})
    {
        return this.composeAndSend(EmailDelegate.EMAIL_TEST, to, data);
    }

    sendIntegrationCreatedEmail(integrationOwner:IntegrationMember):q.Promise<any>
    {
        var self = this;

        return q.all([
            integrationOwner.getUser(),
            integrationOwner.getIntegration()
        ])
            .then(
            function userFetched(...args)
            {
                var user:User = args[0][0];

                var emailData = {
                    integration: args[0][1],
                    integration_url: Utils.addQueryToUrl(DashboardUrls.integration(Config.get(Config.DASHBOARD_URI)), Utils.createSimpleObject(ApiConstants.INTEGRATION_ID, integrationOwner.getIntegrationId()))
                };

                return self.composeAndSend(EmailDelegate.EMAIL_INTEGRATION_ADDED, user.getEmail(), emailData);
            });
    }
}
export = EmailDelegate