///<reference path='../_references.d.ts'/>
import url                                      = require('url');

/*
 * Class to hold all API URLs
 * Used to keep API URLs consistent between SearchNTalk and Coral
 * Note: Not using a generator for fine grained control and prevent unexpected behaviour
 */
class ApiUrlDelegate
{
    /* URL patterns for expert API */
    static expert():string { return this.get('/rest/expert'); }
    static expertById(expertId?:number):string { return this.get('/rest/expert/:expertId(\\d+)', {expertId: expertId}); }
    static expertActivitySummary(expertId?:number):string { return this.get('/rest/expert/:expertId(\\d+)/activity/summary', {expertId: expertId}); }

    /* URL patterns for user API */
    static user():string { return this.get('/rest/user'); }
    static userAuthentication():string { return this.get('/rest/user/authentication'); }
    static userById(userId?:number):string { return this.get('/rest/user/:userId(\\d+)', {userId: userId}); }
    static userIntegrationDetails(userId?:number, integrationId?:number):string { return this.get('/rest/user/:userId(\\d+)/integration/:integrationId(\\d+)', {userId: userId, integrationId: integrationId}); }
    static userActivitySummary(userId?:number):string { return this.get('/rest/user/:userId/activity/summary', {userId: userId}); }
    static userTransactionBalance(userId?:number):string { return this.get('/rest/user/:userId/transactions/balance', {userId: userId}); }

    /* URL patterns for user oauth (FB, LinkedIn ..) */
    static userOAuth():string { return this.get('/rest/user/oauth'); }
    static userOAuthToken(userId?:number, type?:string):string { return this.get('/rest/user/:userId/oauth/:type/token', {userId: userId, type: type}); }

    /* URL patterns for OAuth provider */
    static decision():string { return this.get('/rest/oauth/decision'); }
    static token():string { return this.get('/rest/oauth/token'); }

    /* URL patterns for expert schedules */
    static schedule():string { return this.get('/rest/schedule')}
    static scheduleById(scheduleId?:number):string { return this.get('/rest/schedule/:scheduleId(\\d+)', {scheduleId: scheduleId})}

    /* URL patterns for expert schedule rules*/
    static scheduleRule():string { return this.get('/rest/scheduleRule')}
    static scheduleRuleById(scheduleRuleId?:number):string { return this.get('/rest/scheduleRule/:scheduleRuleId(\\d+)', {scheduleRuleId: scheduleRuleId})}

    /* URL patterns for expert schedule exceptions */
    static scheduleException():string { return this.get('/rest/scheduleException')}
    static scheduleExceptionById(scheduleExceptionId?:number):string { return this.get('/rest/scheduleException/:scheduleExceptionId(\\d+)', {scheduleExceptionId:scheduleExceptionId})}

    /* URL patterns for third party integration */
    static integration():string { return this.get('/rest/integration'); }
    static integrationById(integrationId?:number):string { return this.get('/rest/integration/:integrationId(\\d+)', {integrationId: integrationId}); }
    static integrationSecretReset(integrationId?:number):string { return this.get('/rest/integration/:integrationId(\\d+)/secret/reset', {integrationId: integrationId}); }
    static integrationMember(integrationId?:number):string { return this.get('/rest/integration/:integrationId(\\d+)/member', {integrationId: integrationId}); }
    static integrationMemberById(integrationId?:number, memberId?:number):string { return this.get('/rest/integration/:integrationId(\\d+)/member/:memberId(\\d+)', {integrationId: integrationId, memberId: memberId}); }
    static ownerActivitySummary(integrationId?:number):string { return this.get('/rest/integration/:integrationId(\\d+)/activity/summary', {integrationId: integrationId}); }

    /* URL patterns for payments */
    static payment():string { return this.get('/rest/payment'); }
    static paymentById(paymentId?:number):string { return this.get('/rest/payment/:paymentId(\\d+)', {paymentId: paymentId}); }

    /* URL patterns for payout details */
    static payoutDetail():string { return this.get('/rest/payout-detail'); }
    static payoutDetailById(payoutDetailId?:number):string { return this.get('/rest/payout-detail/:payoutDetailId(\\d+)', {payoutDetailId: payoutDetailId}); }

    /* URL patterns for phone calls */
    static phoneCall():string { return this.get('/rest/call'); }
    static phoneCallById(callId?:number):string { return this.get('/rest/call/:callId(\\d+)', {callId: callId}); }
    static phoneCallReschedule(callId?:number):string { return this.get('/rest/call/:callId(\\d+)/reschedule', {callId: callId}); }
    static phoneCallCancel(callId?:number):string { return this.get('/rest/call/:callId(\\d+)/cancel', {callId: callId}); }

    /* URL patterns for phone numbers */
    static phoneNumber():string { return this.get('/rest/phone-number'); }
    static phoneNumberById(phoneNumberId?:number):string { return this.get('/rest/phone-number/:phoneNumberId(\\d+)', {phoneNumberId: phoneNumberId}); }

    /* URL patterns for transaction */
    static transaction():string { return this.get('/rest/transaction'); }
    static transactionById(transactionId?:number):string { return this.get('/rest/transaction/:transactionId(\\d+)', {transactionId: transactionId}); }
    static transactionItem(transactionId?:number):string { return this.get('/rest/transaction/:transactionId(\\d+)/item', {transactionId: transactionId}); }
    static transactionItemById(transactionId?:number, itemId?:number):string { return this.get('/rest/transaction/:transactionId(\\d+)/item/:itemId(\\d+)', {transactionId: transactionId, itemId: itemId}); }

    /* URL patterns for email */
    static expertInviteEmail():string { return this.get('/rest/email/expert/invitation'); }

    /* URL patterns for user profile */
    static userProfile():string { return this.get('/rest/user/profile'); }
    static userProfileById(profileId?:number):string { return this.get('/rest/user/profile/:profileId(\\d+)', {profileId: profileId}); }

    /* URL patterns for coupons */
    static coupon():string { return this.get('/rest/coupon'); }
    static couponById(couponId?:number):string { return this.get('/rest/coupon/:couponId(\\d+)', {couponId: couponId}); }
    static couponValidation():string { return this.get('/rest/coupon/validation'); }

    /* URL patterns for Twilio */
    static twiml():string { return this.get('/rest/twiml'); }
    static twimlJoinConference():string { return this.get('/rest/twiml/call'); }
    static twimlCallExpert(callId?:number):string { return this.get('/rest/twiml/call/:callId(\\d+)/expert', {callId: callId}); }
    static twimlCall(callId?:number):string { return this.get('/rest/twiml/call/:callId(\\d+)', {callId: callId}); }

    /* URL patterns for temporary tokens (invite codes, password reset, mobile verification etc.) */
    static tempToken():string { return this.get('/rest/token'); }
    static mobileVerificationCode():string { return this.get('/rest/code/mobile/verification'); }
    static expertInvitationCode():string { return this.get('/rest/code/expert/invitation'); }

    /*
     * Helper method to generate URLs with values substituted for parameters (if supplied)
     * @param urlPattern
     * @param values
     * @returns {string}
     */
    static get(urlPattern:string, values?:Object):string {
        if (values)
            for (var key in values)
                if (values[key] != null)
                    urlPattern = urlPattern.replace(new RegExp(':' + key), values[key])
        return urlPattern;
    }
}
export = ApiUrlDelegate