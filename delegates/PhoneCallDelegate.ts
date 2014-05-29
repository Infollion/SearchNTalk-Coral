///<reference path='../_references.d.ts'/>
import _                                                                = require('underscore');
import q                                                                = require('q');
import Utils                                                            = require('../common/Utils');
import Config                                                           = require('../common/Config');
import PhoneCallDao                                                     = require('../dao/PhoneCallDao');
import BaseDaoDelegate                                                  = require('../delegates/BaseDaoDelegate');
import IntegrationMemberDelegate                                        = require('../delegates/IntegrationMemberDelegate');
import UserPhoneDelegate                                                = require('../delegates/UserPhoneDelegate');
import UserDelegate                                                     = require('../delegates/UserDelegate');
import NotificationDelegate                                             = require('../delegates/NotificationDelegate');
import CallStatus                                                       = require('../enums/CallStatus');
import IncludeFlag                                                      = require('../enums/IncludeFlag');
import PhoneType                                                        = require('../enums/PhoneType');
import PhoneCall                                                        = require('../models/PhoneCall');
import User                                                             = require('../models/User');
import UserPhone                                                        = require('../models/UserPhone');
import IntegrationMember                                                = require('../models/IntegrationMember');
import TriggerPhoneCallTask                                             = require('../models/tasks/TriggerPhoneCallTask');
import UnscheduledCallsCache                                            = require('../caches/UnscheduledCallsCache');
import PhoneCallCache                                                   = require('../caches/PhoneCallCache');
import CallProviderFactory                                              = require('../factories/CallProviderFactory');

class PhoneCallDelegate extends BaseDaoDelegate
{
    static ALLOWED_NEXT_STATUS:{ [s: number]: CallStatus[]; } = {};

    private integrationMemberDelegate = new IntegrationMemberDelegate();
    private userDelegate = new UserDelegate();
    private userPhoneDelegate = new UserPhoneDelegate();
    private callProvider = new CallProviderFactory().getProvider();
    private phoneCallCache = new PhoneCallCache();

    private static ctor = (() =>
    {
        PhoneCallDelegate.ALLOWED_NEXT_STATUS[CallStatus.PLANNING] = [CallStatus.SCHEDULING, CallStatus.CANCELLED];
        PhoneCallDelegate.ALLOWED_NEXT_STATUS[CallStatus.SCHEDULING] = [CallStatus.SCHEDULED, CallStatus.CANCELLED];
        PhoneCallDelegate.ALLOWED_NEXT_STATUS[CallStatus.SCHEDULED] = [CallStatus.CANCELLED, CallStatus.POSTPONED, CallStatus.IN_PROGRESS];
        PhoneCallDelegate.ALLOWED_NEXT_STATUS[CallStatus.CANCELLED] = [];
        PhoneCallDelegate.ALLOWED_NEXT_STATUS[CallStatus.COMPLETED] = [];
        PhoneCallDelegate.ALLOWED_NEXT_STATUS[CallStatus.IN_PROGRESS] = [CallStatus.COMPLETED, CallStatus.FAILED];
        PhoneCallDelegate.ALLOWED_NEXT_STATUS[CallStatus.FAILED] = [CallStatus.SCHEDULING];
        PhoneCallDelegate.ALLOWED_NEXT_STATUS[CallStatus.POSTPONED] = [CallStatus.SCHEDULING, CallStatus.CANCELLED];
        PhoneCallDelegate.ALLOWED_NEXT_STATUS[CallStatus.AGENDA_DECLINED] = [CallStatus.SCHEDULING];
    })();

    get(id:any, fields?:string[], includes:IncludeFlag[] = [], transaction?:Object):q.Promise<any>
    {
        var superGet = super.get;
        var self = this;

        return this.phoneCallCache.get(id)
            .then(
            function callFetched(result):any
            {
                if (!Utils.isNullOrEmpty(result))
                    return new PhoneCall(result);
                else
                    return superGet.call(self, id, fields, includes, transaction);
            },
            function callFetchError()
            {
                return superGet(id, fields, includes);
            });
    }

    update(criteria:Object, newValues:Object, transaction?:Object):q.Promise<any>;
    update(criteria:number, newValues:Object, transaction?:Object):q.Promise<any>;
    update(criteria:any, newValues:Object, transaction?:Object):q.Promise<any>
    {
        var newStatus = newValues.hasOwnProperty(PhoneCall.STATUS) ? newValues[PhoneCall.STATUS] : null;

        if (!Utils.isNullOrEmpty(newStatus))
        {
            if (Utils.getObjectType(criteria) == 'Number')
                criteria = {id: criteria};

            // Only return calls whose current status' next step can be the new status
            // This is a better way to update status to a valid next status without querying for current status first
            var allowedPreviousStatuses:CallStatus[] = _.filter(_.keys(PhoneCallDelegate.ALLOWED_NEXT_STATUS), function (status:CallStatus)
            {
                return _.contains(PhoneCallDelegate.ALLOWED_NEXT_STATUS[status], newStatus);
            });

            if (allowedPreviousStatuses.length > 0)
                criteria[PhoneCall.STATUS] = allowedPreviousStatuses;
        }

        return super.update(criteria, newValues, transaction);
    }

    getIncludeHandler(include:IncludeFlag, result:PhoneCall):q.Promise<any>
    {
        var self = this;
        switch (include)
        {
            case IncludeFlag.INCLUDE_INTEGRATION_MEMBER:
                return self.integrationMemberDelegate.get(result.getIntegrationMemberId(), null, [IncludeFlag.INCLUDE_USER]);
            case IncludeFlag.INCLUDE_USER:
                return self.userDelegate.get(result.getCallerUserId());
            case IncludeFlag.INCLUDE_EXPERT_PHONE:
                return self.userPhoneDelegate.get(result.getExpertPhoneId());
            case IncludeFlag.INCLUDE_USER_PHONE:
                return self.userPhoneDelegate.get(result.getCallerPhoneId());
        }
        return super.getIncludeHandler(include, result);
    }

    /* Trigger the call */
    triggerCall(callId:number):q.Promise<any>
    {
        var self = this;
        return self.get(callId, null, [IncludeFlag.INCLUDE_USER_PHONE])
            .then(
            function callFetched(call:PhoneCall)
            {
                return self.callProvider.makeCall(call.getUserPhone().getCompleteNumber(), callId, call.getNumReattempts());
            })
            .fail(
            function callFailed(error)
            {
                self.logger.error("Error in call triggering, error: %s", JSON.stringify(error));
            });
    }

    /* Queue the call for triggering */
    queueCallForTriggering(call:number);
    queueCallForTriggering(call:PhoneCall);
    queueCallForTriggering(call:any)
    {
        var self = this;

        if (Utils.getObjectType(call) == 'Number')
            return self.get(call, null, [IncludeFlag.INCLUDE_USER])
                .then(function (fetchedCall:PhoneCall)
                {
                    self.queueCallForTriggering(fetchedCall);
                });

        //TODO[ankit] check whether the call has not been scheduled already as new call scheduled in next one hour are scheduled manually
        var ScheduledTaskDelegate = require('../delegates/ScheduledTaskDelegate');
        var scheduledTaskDelegate = new ScheduledTaskDelegate();
        scheduledTaskDelegate.scheduleAt(new TriggerPhoneCallTask(call.getId()), call.getStartTime());
    }

    /* Cancel call */
    cancelCall(callId:number, cancelledByUser:number):q.Promise<any>
    {
        // If cancelled by user, create a call cancellation transaction in his account
        return null;
    }

    /**
     * Process call scheduling based on expert/caller input
     * Called when either caller/expert respond the time slots suggested by other party
     * The call may get
     *  - Cancelled (if either party cancels)
     *  - Scheduled (if either party agrees to one of suggested)
     *  - Remain unchanged (if suggested slots are rejected and alternates suggested)
     * */
    handleSchedulingRequest(callId:number, requesterUserId:number, originalSlots:number[], pickedSlots:number[], reason?:string):q.Promise<any>
    {
        return null;

        var notificationDelegate = new NotificationDelegate();
        var self = this;

        return this.get(callId, null, [IncludeFlag.INCLUDE_USER, IncludeFlag.INCLUDE_INTEGRATION_MEMBER])
            .then(
            function callFetched(call:PhoneCall)
            {
                var isConfirmation = pickedSlots.length == 1 && _.contains(originalSlots, pickedSlots[0]);
                var isSuggestion = _.intersection(originalSlots, pickedSlots).length == 0;
                var isRejection = !Utils.isNullOrEmpty(reason);

                if (isConfirmation)
                {
                    // Send notifications to both
                    return notificationDelegate.sendCallSchedulingCompleteNotifications(call, pickedSlots[0]);
                }
                else if (isSuggestion)
                {
                    // Send notification to other party
                    var isExpert = call.getIntegrationMember().getUser().getId() == requesterUserId;
                    var isCaller = call.getCallerUserId() == requesterUserId;

                    if (isExpert)
                        return notificationDelegate.sendNewTimeSlotsToExpert(call, pickedSlots);
                    else if (isCaller)
                        return notificationDelegate.sendSuggestedAppointmentToCaller(call, pickedSlots[0]);
                }
                else if (isRejection)
                {
                    return self.cancelCall(callId, requesterUserId)
                        .then(
                        function callCancelled()
                        {
                            return notificationDelegate.sendCallRejectedNotifications(call, reason);
                        });
                }
                else
                    throw('Invalid request');
            });
    }

    constructor() { super(new PhoneCallDao()); }
}
export = PhoneCallDelegate
