///<reference path='../_references.d.ts'/>
import _                                            = require('underscore');
import q                                            = require('q');
import moment                                       = require('moment');
import Utils                                        = require('../common/Utils');
import BaseDaoDelegate                              = require('../delegates/BaseDaoDelegate');
import MysqlDelegate                                = require('../delegates/MysqlDelegate');
import ExpertScheduleDelegate                       = require('../delegates/ExpertScheduleDelegate');
import IntegrationDelegate                          = require('../delegates/IntegrationDelegate');
import UserDelegate                                 = require('../delegates/UserDelegate');
import UserProfileDelegate                          = require('../delegates/UserProfileDelegate');
import IntegrationMemberDAO                         = require ('../dao/IntegrationMemberDao');
import IntegrationMemberRole                        = require('../enums/IntegrationMemberRole');
import IncludeFlag                                  = require('../enums/IncludeFlag');
import Integration                                  = require('../models/Integration');
import User                                         = require('../models/User');
import IntegrationMember                            = require('../models/IntegrationMember');
import AccessTokenCache                             = require('../caches/AccessTokenCache');
import ExpertScheduleRuleDelegate                   = require('../delegates/ExpertScheduleRuleDelegate');

class IntegrationMemberDelegate extends BaseDaoDelegate
{
    private expertScheduleRuleDelegate = new ExpertScheduleRuleDelegate();

    create(object:Object, transaction?:any):q.Promise<any>
    {
        var self = this;

        if (Utils.isNullOrEmpty(transaction))
            return MysqlDelegate.executeInTransaction(self, arguments);

        var integrationMember = new IntegrationMember(object);
        integrationMember.setAuthCode(Utils.getRandomString(30));

        return super.create(integrationMember, transaction)
            .then(
            function expertCreated(expert:IntegrationMember)
            {
                integrationMember.setId(expert.getId());
                return self.expertScheduleRuleDelegate.createDefaultRules(expert.getId(), transaction);
            })
            .then(
            function rulesCreated()
            {
                self.logger.debug('Default schedule rules created');
                return integrationMember;
            })
            .fail(
            function expertCreateFailed(error)
            {
                self.logger.error('Error occurred while creating new expert, error: %s', JSON.stringify(error));
                throw(error);
            });
    }

    findValidAccessToken(accessToken:string, integrationMemberId?:string, role?:IntegrationMemberRole):q.Promise<any>
    {
        var accessTokenCache = new AccessTokenCache();
        var self = this;

        function tokenFetched(result)
        {
            if (_.isArray(result)) result = result[0];

            if (result
                    && (!integrationMemberId || result['integration_member_id'] === integrationMemberId)
                        && (!role || result['role'] === role))
                return new IntegrationMember(result);

            return null;
        }

        return accessTokenCache.getAccessTokenDetails(accessToken)
            .then(
            tokenFetched,
            function tokenFromCacheError(error)
            {
                // Try fetching from database
                self.logger.debug("Couldn't get token details from cache, hitting db, Error: " + error);
                return self.search({'access_token': accessToken}, [])
                    .then(tokenFetched)
            }
        );
    }

    findByEmail(email:string, integrationId?:number):q.Promise<IntegrationMember>
    {
        var query = 'SELECT im.* ' +
            'FROM integration_member im, user u ' +
            'WHERE im.user_id = u.id ' +
            'AND u.email = ? ';
        var values:any[] = [email];

        if (!Utils.isNullOrEmpty(integrationId))
        {
            query += ' AND integration_id = ?';
            values.push(integrationId);
        }

        query += ' LIMIT 1';

        return MysqlDelegate.executeQuery(query, values)
            .then(
            function membersFound(members)
            {
                if (!Utils.isNullOrEmpty(members))
                    return new IntegrationMember(members[0]);
                return null;
            });
    }

    getIncludeHandler(include:IncludeFlag, result:any):q.Promise<any>
    {
        result = [].concat(result);

        switch (include)
        {
            case IncludeFlag.INCLUDE_INTEGRATION:
                return new IntegrationDelegate().get(_.uniq(_.pluck(result, IntegrationMember.INTEGRATION_ID)));
            case IncludeFlag.INCLUDE_USER:
                var UserDelegate:any = require('./UserDelegate');
                return new UserDelegate().get(_.uniq(_.pluck(result, IntegrationMember.USER_ID)));
            case IncludeFlag.INCLUDE_USER_PROFILE:
                return new UserProfileDelegate().search({'user_id': _.uniq(_.pluck(result, IntegrationMember.USER_ID))});
            case IncludeFlag.INCLUDE_SCHEDULES:
                // Return schedules for next 4 months
                var scheduleStartTime = moment().hours(0).valueOf();
                var scheduleEndTime = moment().add({months: 4}).valueOf();

                return new ExpertScheduleDelegate().getSchedulesForExpert(result[0][IntegrationMember.ID], scheduleStartTime, scheduleEndTime);
            case IncludeFlag.INCLUDE_SCHEDULE_RULES:
                return new ExpertScheduleRuleDelegate().getRulesByIntegrationMemberId(result[0][IntegrationMember.ID]);
        }
        return super.getIncludeHandler(include, result);
    }

    constructor() { super(new IntegrationMemberDAO()); }
}
export = IntegrationMemberDelegate
