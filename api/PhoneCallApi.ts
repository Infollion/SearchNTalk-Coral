import json2xml                                             = require('json2xml');
import express                                              = require('express');
import connect_ensure_login                                 = require('connect-ensure-login');
import ApiConstants                                         = require('../enums/ApiConstants');
import ApiUrlDelegate                                       = require('../delegates/ApiUrlDelegate');
import PhoneCallDelegate                                    = require('../delegates/PhoneCallDelegate');
import AccessControl                                        = require('../middleware/AccessControl');
import RequestHandler                                       = require('../middleware/RequestHandler');
import PhoneCall                                            = require('../models/PhoneCall');
import User                                                 = require('../models/User');
import Utils                                                = require('../common/Utils');

/*
 * API calls for managing phone calls
 */
class PhoneCallApi
{
    constructor(app, secureApp)
    {
        var phoneCallDelegate = new PhoneCallDelegate();

        app.put(ApiUrlDelegate.phoneCall(), connect_ensure_login.ensureLoggedIn(), function (req:express.Request, res:express.Response)
        {
            var phoneCall:PhoneCall = req.body[ApiConstants.PHONE_CALL];

            phoneCallDelegate.create(phoneCall)
                .then(
                    function callCreated(result) { res.send(result); },
                    function callCreateError(error) { res.send(500); }
                )
        });

        app.post(ApiUrlDelegate.phoneCallById(), connect_ensure_login.ensureLoggedIn(), function (req:express.Request, res:express.Response)
        {
            var phoneCallId:number = req.params[ApiConstants.PHONE_CALL_ID];
            var phoneCall:PhoneCall = req.body[ApiConstants.PHONE_CALL];

            phoneCallDelegate.update({id: phoneCallId}, phoneCall)
                .then(
                    function callUpdated() { res.send(200); },
                    function callUpdateError(error) { res.status(500); }
                )
        });

        app.post(ApiUrlDelegate.phoneCallScheduling(), function (req:express.Request, res:express.Response)
        {
            // 1. Update call status
            // 2. Send emails to both caller and expert
            // 3. Send SMS to both caller and expert

            var self = this;
            var loggedInUser:User = req[ApiConstants.USER];
            var callId:number = parseInt(req.params[ApiConstants.PHONE_CALL_ID]);
            var appointmentCode:string = req.query[ApiConstants.CODE] || req.body[ApiConstants.CODE];

            var pickedTimeSlots = [].concat(req.body[ApiConstants.START_TIME] || req.query[ApiConstants.START_TIME]);
            var reason:string = req.body[ApiConstants.REASON];

            if (pickedTimeSlots.length != 0 || !Utils.isNullOrEmpty(reason))
            {
                self.verificationCodeDelegate.verifyAppointmentAcceptCode(appointmentCode)
                    .then(
                    function callAndSchedulingDetailsFetched(appointment)
                    {
                        return self.phoneCallDelegate.handleSchedulingRequest(callId, loggedInUser.getId(), appointment.startTimes, pickedTimeSlots, reason);
                    });
            }
            else
                res.render('500', {error: 'Invalid request'});
        });

        app.get(ApiUrlDelegate.phoneCallById(), connect_ensure_login.ensureLoggedIn(), function (req:express.Request, res:express.Response)
        {
            var phoneCallId:number = req.params[ApiConstants.PHONE_CALL_ID];

            return phoneCallDelegate.get(phoneCallId)
                .then(
                    function callFetched(call) { res.json(call); },
                    function callFetchFailed(error) { res.status(400).send('No phone call found for id: ' + phoneCallId); }
                )
        });

        app.get(ApiUrlDelegate.phoneCall(), RequestHandler.requireFilters, connect_ensure_login.ensureLoggedIn(), function (req:express.Request, res:express.Response)
        {
            var filters = req.body[ApiConstants.FILTERS];

            phoneCallDelegate.search(filters)
                .then(
                function handleCallSearched(response) { res.json(response); },
                function handleCallSearchFailed(error) { res.status(500).json(error); }
            );
        });


    }
}
export = PhoneCallApi