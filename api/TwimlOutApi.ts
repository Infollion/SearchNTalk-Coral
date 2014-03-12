import express                      = require('express');
import json2xml                     = require('json2xml');
import ApiConstants                 = require('../enums/ApiConstants');
import ApiFlags                     = require('../enums/ApiFlags');
import PhoneType                    = require('../enums/PhoneType');
import CallFragmentStatus           = require('../enums/CallFragmentStatus');
import AgentType                    = require('../enums/AgentType');
import IntegrationMemberDelegate    = require('../delegates/IntegrationMemberDelegate');
import TwilioDelegate               = require('../delegates/calling/TwilioDelegate');
import PhoneCallDelegate            = require('../delegates/PhoneCallDelegate');
import UserPhoneDelegate            = require('../delegates/UserPhoneDelegate');
import TwilioUrlDelegate            = require('../delegates/TwilioUrlDelegate');
import CallFragmentDelegate         = require('../delegates/CallFragmentDelegate');
import SMSDelegate                  = require('../delegates/SMSDelegate');
import TimeJobDelegate              = require('../delegates/TimeJobDelegate');
import Utils                        = require('../common/Utils');
import Config                       = require('../common/Config');
import PhoneCall                    = require('../models/PhoneCall');
import User                         = require('../models/User');
import IntegrationMember            = require('../models/IntegrationMember');
import UserPhone                    = require('../models/UserPhone');
import CallFragment                 = require('../models/CallFragment');
import PhoneCallCache               = require('../caches/PhoneCallCache')

class TwimlOutApi
{
    private static ATTEMPTCOUNT:string = 'attemptCount';
    private static DIALCALLSID:string = 'DialCallSid';
    private static CALLSID:string = 'CallSid';
    private static USERNUMBER:string = 'To';
    private static COMPLETED:string = 'completed'; //TODO same definition being repeated in CallFragmentDelegate
    private static BUSY:string = 'busy';
    private static FAILED:string = 'failed';
    private static NOANSWER:string = 'no-answer';
    private static DIALCALLSTATUS:string = 'DialCallStatus';
    private static CALLSTATUS:string = 'CallStatus';
    private static DURATION:string = 'Duration';
    private static START_TIME:string = 'start_time';


    constructor(app)
    {
        app.get(TwilioUrlDelegate.twimlJoinCall(), function (req:express.Request, res:express.Response)
        {
            var callId = parseInt(req.params[ApiConstants.PHONE_CALL_ID]);
            var expert:IntegrationMember, user:User,call:PhoneCall;
            new PhoneCallDelegate().get(callId, null, [ApiFlags.INCLUDE_INTEGRATION_MEMBER_USER])
                .then(
                function callFetched(tempCall:PhoneCall)
                {
                    call = tempCall;
                    expert = call[ApiFlags.INCLUDE_INTEGRATION_MEMBER_USER];
                    user = expert[ApiFlags.INCLUDE_USER];
                    return new UserPhoneDelegate().get(call.getCallerPhoneId());
                })
                .then(
                function PhoneRecord(userPhone:UserPhone)
                {
                    var phoneNumber:string = '+' + userPhone.getCountryCode();
                    if(userPhone.getType() == PhoneType.LANDLINE)
                        phoneNumber += userPhone.getAreaCode();
                    phoneNumber += userPhone.getPhone();

                    var pageData = {};
                    pageData['actionURL'] = req.protocol + "://" + req.get('host') + TwilioUrlDelegate.twimlJoinCall(callId);
                    pageData['timeLimit'] = call.getDuration();
                    pageData['phoneNumber'] = phoneNumber;
                    pageData['record'] = (call.getRecorded() == false) ? 'false':'true' ;
                    pageData['message'] = 'Please wait while we get Mr. ' + user.getFirstName() + ' ' + user.getLastName() + ' on the call';
                    res.render('../delegates/calling/TwilioXMLJoin.jade',pageData );
                })
                .fail(function(error){
                    var pageData = {};
                    pageData['message'] = 'Internal Server Error';
                    res.render('../delegates/calling/TwilioXMLSay.jade',pageData );
                })
        });

        app.post(TwilioUrlDelegate.twimlJoinCall(), function (req:express.Request, res:express.Response)
        {
            var attemptCount = parseInt(req.query[TwimlOutApi.ATTEMPTCOUNT]);
            if(Utils.isNullOrEmpty(attemptCount))
                attemptCount = 0;

            var dialCallStatus = req.body[TwimlOutApi.DIALCALLSTATUS];
            var pageData = {};

            var callFragment:CallFragment = new CallFragment();
            callFragment.setCallId(parseInt(req.params[ApiConstants.PHONE_CALL_ID]));
            callFragment.setAgentCallSidExpert(req.body[TwimlOutApi.DIALCALLSID]);
            callFragment.setAgentCallSidUser(req.body[TwimlOutApi.CALLSID]);
            callFragment.setFromNumber(req.body[TwimlOutApi.USERNUMBER]);
            callFragment.setCallFragmentStatus(CallFragmentStatus.FAILED_EXPERT_ERROR); // if successful then this value will be overwritten

            switch(dialCallStatus)
            {
                case TwimlOutApi.COMPLETED:
                    pageData['message'] = 'Call Completed. Thank you for using our services';
                    break;
                case TwimlOutApi.BUSY:
                    pageData['message'] = 'Call could not be completed. We regret the inconvenience caused.';
                    break;
                case TwimlOutApi.NOANSWER:
                    if(attemptCount == 1)
                        pageData['message'] = 'Call could not be completed. We regret the inconvenience caused';
                    else
                        pageData['message'] = 'Expert did not answer the call. We will retry in ' + Config.get("call.retry.gap.text") +  ' minutes';
                    break;
                default:
                    if(attemptCount == 1)
                        pageData['message'] = 'Call could not be completed. We regret the inconvenience caused';
                    else
                        pageData['message'] = 'The expert is unreachable. We will retry in ' + Config.get("call.retry.gap.text") + ' minutes';
            }
            res.render('../delegates/calling/TwilioXMLSay.jade',pageData );

            if(attemptCount == 0 && dialCallStatus != TwimlOutApi.COMPLETED && dialCallStatus != TwimlOutApi.BUSY)
                console.log('Reattempt to be made');// TODO change this to rescheduling function

            new CallFragmentDelegate().saveCallFragment(callFragment);

            //TODO don't send sms to landline (twilio doesn't send it and return error code 21614). However, we should not even make the api call.
            new SMSDelegate().sendStatusSMS(callFragment, attemptCount);

        });

        app.post(TwilioUrlDelegate.twimlCallback(), function (req:express.Request, res:express.Response)
        {
            res.json('OK');
            var callStatus = req.body[TwimlOutApi.CALLSTATUS];
            var attemptCount = parseInt(req.query[TwimlOutApi.ATTEMPTCOUNT]);
            if(Utils.isNullOrEmpty(attemptCount))
                attemptCount = 0;

            if(callStatus != TwimlOutApi.COMPLETED) // if completed then information saved after expert drops the call
            {
                if(attemptCount == 0)
                    console.log('Reattempt to be made');// TODO change this to rescheduling function, make change in num_reattempt in call table
                var duration:number = parseInt(req.body[TwimlOutApi.DURATION]);

                var callFragment:CallFragment = new CallFragment();
                callFragment.setCallId(parseInt(req.params[ApiConstants.PHONE_CALL_ID]));
                callFragment.setAgentCallSidUser(req.body[TwimlOutApi.CALLSID]);
                callFragment.setFromNumber(req.body[TwimlOutApi.USERNUMBER]);
                callFragment.setDuration(duration);
                callFragment.setAgentId(AgentType.TWILIO);
                if(callStatus == TwimlOutApi.FAILED)
                    callFragment.setCallFragmentStatus(CallFragmentStatus.FAILED_SERVER_ERROR);
                else
                    callFragment.setCallFragmentStatus(CallFragmentStatus.FAILED_USER_ERROR);

                var twilioClient = require('twilio')(Config.get('twilio.account_sid'), Config.get('twilio.auth_token'));
                twilioClient.calls(callFragment.getAgentCallSidUser()).get(
                    function(err, callDetails)
                    {
                        if(!Utils.isNullOrEmpty(callDetails))
                        {
                            var startTime:Date = new Date(callDetails[TwimlOutApi.START_TIME]);
                            callFragment.setStartTime(startTime.getTimeInSec());
                            new CallFragmentDelegate().create(callFragment);
                        }
                    });
                new PhoneCallDelegate().get(callFragment.getCallId())
                    .then(
                    function callFetched(call:PhoneCall)
                    {
                        return new UserPhoneDelegate().getByUserId(call.getExpertPhoneId());
                    })
                    .then(
                    function PhoneRecord(expertPhone:UserPhone)
                    {
                        var tempCallFragment:CallFragment = callFragment;
                        if(expertPhone.getType() == PhoneType.MOBILE)
                        {
                            var phoneNumber:string = '+' + expertPhone.getCountryCode() + expertPhone.getPhone();
                            tempCallFragment.setToNumber(phoneNumber);
                        }
                        new SMSDelegate().sendStatusSMS(tempCallFragment, attemptCount);
                    })
                    .fail(function(error){
                        //TODO
                    })
            }
        });

        //TODO remove this after testing
        app.get(TwilioUrlDelegate.twimlGenerateCall(), function (req:express.Request, res:express.Response)
        {
            var callId = parseInt(req.params[ApiConstants.PHONE_CALL_ID]);
            var url:string = req.protocol + "://" + req.get('host') + TwilioUrlDelegate.twimlJoinCall(callId);
            var callbackUrl:string = req.protocol + "://" + req.get('host') + TwilioUrlDelegate.twimlCallback(callId);
            new PhoneCallDelegate().get(callId, null, [ApiFlags.INCLUDE_INTEGRATION_MEMBER_USER])
                .then(
                function callFetched(call:PhoneCall)
                {
                    //return new PhoneCallCache().createPhoneCallCache(call);
                    new PhoneCallCache().getPhoneCall(callId)
                        .then(
                            function(call:PhoneCall)
                            {
                                console.log("d");
                            }
                        )
                });
            /*var ttt = new TimeJobDelegate().scheduleJobs()
                .then (
                function jobsFetched(jobs)
                {
                    res.json(jobs.length);
                },
                function fetchError(error)
                {
                    res.json('ERROR');
                }
            );*/
        });
    }
}
export = TwimlOutApi

