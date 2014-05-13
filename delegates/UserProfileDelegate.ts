///<reference path='../_references.d.ts'/>
import _                                        = require('underscore');
import passport                                 = require('passport');
import passport_linkedin                        = require('passport-linkedin');
import q                                        = require('q');
import OAuth                                    = require('oauth');
import BaseDaoDelegate                          = require('./BaseDaoDelegate');
import UserEmploymentDelegate                   = require('../delegates/UserEmploymentDelegate');
import UserEducationDelegate                    = require('../delegates/UserEducationDelegate');
import UserSkillDelegate                        = require('../delegates/UserSkillDelegate');
import UserUrlDelegate                          = require('../delegates/UserUrlDelegate');
import SkillCodeDelegate                        = require('../delegates/SkillCodeDelegate');
import UserOAuthDelegate                        = require('../delegates/UserOAuthDelegate');
import ImageDelegate                            = require('../delegates/ImageDelegate');
import IntegrationMemberDelegate                = require('../delegates/IntegrationMemberDelegate');
import MysqlDelegate                            = require('../delegates/MysqlDelegate');
import UserProfileDao                           = require('../dao/UserProfileDao');
import UserProfile                              = require('../models/UserProfile');
import UserSkill                                = require('../models/UserSkill');
import UserEmployment                           = require('../models/UserEmployment');
import UserEducation                            = require('../models/UserEducation');
import UserUrl                                  = require('../models/UserUrl');
import SkillCode                                = require('../models/SkillCode');
import User                                     = require('../models/User');
import UserOauth                                = require('../models/UserOauth');
import IntegrationMember                        = require('../models/IntegrationMember');
import Config                                   = require('../common/Config');
import Utils                                    = require('../common/Utils');
import IndustryCodes                            = require('../enums/IndustryCode');
import IncludeFlag                              = require('../enums/IncludeFlag');
import ProfileStatus                            = require('../enums/ProfileStatus');

class UserProfileDelegate extends BaseDaoDelegate
{
    static BASIC_FIELDS:string[] = ['id', 'first-name', 'last-name', 'email-address', 'headline', 'industry', 'summary', 'date-of-birth'];
    static EDUCATION_FIELDS:string[] = ['educations'];
    static POSITION_FIELDS:string[] = ['positions'];
    static SKILL_FIELDS:string[] = ['skills'];
    static IMAGE_FIELDS:string[] = ['picture-urls::(original)'];

    constructor() { super(new UserProfileDao()); }

    fetchSelectedFieldsFromLinkedIn(userId:number, integrationId:number, profileFields:string[], transaction?:any):q.Promise<any>
    {
        var fields:string = profileFields.join(',');

        return new UserOAuthDelegate().find({'user_id': userId})
            .then(
            function detailsFetched(userOauth:UserOauth)
            {
                var deferred = q.defer();

                if (Utils.isNullOrEmpty(userOauth))
                    throw('No oauth entry found');

                var oauth = new OAuth.OAuth(
                    'https://www.linkedin.com/uas/oauth/authenticate?oauth_token=',
                    'https://api.linkedin.com/uas/oauth/accessToken',
                    Config.get(Config.LINKEDIN_API_KEY),
                    Config.get(Config.LINKEDIN_API_SECRET),
                    '1.0A',
                    null,
                    'HMAC-SHA1'
                );
                oauth.get(
                    'https://api.linkedin.com/v1/people/~:(' + fields + ')?format=json ',
                    userOauth.getAccessToken(),
                    userOauth.getRefreshToken(),
                    function (e, data, res)
                    {
                        if (e)
                            deferred.reject(e);
                        else
                        {
                            var profile = JSON.parse(data);
                            deferred.resolve(profile);
                        }
                    }
                );

                return deferred.promise;
            });

    }

    fetchEducationDetailsFromLinkedIn(userId:number, integrationId:number, profileId:number, transaction?:any):q.Promise<any>
    {
        var self = this;

        if (Utils.isNullOrEmpty(transaction))
            return MysqlDelegate.executeInTransaction(self, arguments);

        return self.fetchSelectedFieldsFromLinkedIn(userId, integrationId, UserProfileDelegate.EDUCATION_FIELDS, transaction)
            .then(function EducationDetailsFetched(profile)
            {
                if (!Utils.isNullOrEmpty(profile.educations) && profile.educations._total > 0)
                {
                    return q.all(_.map(profile.educations.values, function (education:any)
                    {
                        var tempUserEducation:UserEducation = new UserEducation();
                        tempUserEducation.setSchoolName(education.schoolName);
                        tempUserEducation.setFieldOfStudy(education.fieldOfStudy);
                        tempUserEducation.setDegree(education.degree);
                        tempUserEducation.setActivities(education.activities);
                        tempUserEducation.setNotes(education.notes);
                        tempUserEducation.setStartYear(education.startDate ? education.startDate.year : null);
                        tempUserEducation.setEndYear(education.endDate ? education.endDate.year : null);

                        return new UserEducationDelegate().createUserEducation(tempUserEducation, profileId, transaction);
                    }));
                }
            })
            .fail(function EducationDetailsFetchedError(error)
            {
                self.logger.error(error);
                throw(error);
            })
    }

    fetchEmploymentDetailsFromLinkedIn(userId:number, integrationId:number, profileId:number, transaction?:any):q.Promise<any>
    {
        var self = this;

        if (Utils.isNullOrEmpty(transaction))
            return MysqlDelegate.executeInTransaction(self, arguments);

        return self.fetchSelectedFieldsFromLinkedIn(userId, integrationId, UserProfileDelegate.POSITION_FIELDS, transaction)
            .then(function EmploymentDetailsFetched(profile)
            {
                if (!Utils.isNullOrEmpty(profile.positions) && profile.positions._total > 0)
                {
                    return q.all(_.map(profile.positions.values, function (position:any)
                    {
                        var tempUserEmployment:UserEmployment = new UserEmployment();
                        tempUserEmployment.setIsCurrent(position.isCurrent);
                        tempUserEmployment.setTitle(position.title);
                        tempUserEmployment.setSummary(position.summary);
                        tempUserEmployment.setCompany(position.company ? position.company.name : null);

                        if (!Utils.isNullOrEmpty(position.startDate))
                            tempUserEmployment.setStartDate((position.startDate.month || 1) + '-' + (position.startDate.year || null));

                        if (!position.isCurrent && !Utils.isNullOrEmpty(position.endDate))
                            tempUserEmployment.setEndDate((position.endDate.month || 12) + '-' + (position.endDate.year || null));

                        return new UserEmploymentDelegate().createUserEmployment(tempUserEmployment, profileId, transaction);
                    }));
                }
            })
            .fail(function EmploymentDetailsFetchedError(error)
            {
                self.logger.error(error);
                throw(error);
            })
    }

    fetchProfilePictureFromLinkedIn(userId:number, integrationId:number, profileId:number, transaction?:any):q.Promise<any>
    {
        var self = this;

        return self.fetchSelectedFieldsFromLinkedIn(userId, integrationId, UserProfileDelegate.IMAGE_FIELDS, transaction)
            .then(function ImageDetailsFetched(profile)
            {
                var profilePictureUrl;
                if (profile.pictureUrls && profile.pictureUrls.values.length > 0)
                    profilePictureUrl = profile.pictureUrls.values[0];

                if (!Utils.isNullOrEmpty(profilePictureUrl))
                {
                    var tempProfilePicturePath = Config.get(Config.TEMP_IMAGE_PATH) + Math.random();
                    return new ImageDelegate().fetch(profilePictureUrl, tempProfilePicturePath)
                        .then(
                        function imageFetched()
                        {
                            var UserDelegate = require('../delegates/UserDelegate');
                            return new UserDelegate().processProfileImage(userId, tempProfilePicturePath);
                        })
                }
            })
            .fail(function ImageDetailsFetchedError(error)
            {
                self.logger.error(error);
                throw(error);
            })
    }

    fetchSkillDetailsFromLinkedIn(userId:number, integrationId:number, profileId:number, transaction?:any):q.Promise<any>
    {
        var self = this;

        if (Utils.isNullOrEmpty(transaction))
            return MysqlDelegate.executeInTransaction(self, arguments);

        return self.fetchSelectedFieldsFromLinkedIn(userId, integrationId, UserProfileDelegate.SKILL_FIELDS, transaction)
            .then(
            function SkillDetailsFetched(profile)
            {
                if (!Utils.isNullOrEmpty(profile.skills) && profile.skills._total > 0)
                    var tasks = _.map(profile.skills.values, function (skillObject:any)
                    {
                        return new SkillCodeDelegate().createSkillCodeFromLinkedIn(skillObject.skill.name, transaction)
                            .then(
                            function skillCodesCreated(createdSkillCodes:SkillCode)
                            {
                                var userSkill = new UserSkill();
                                userSkill.setSkillId(createdSkillCodes.getId())
                                return new UserSkillDelegate().createUserSkillWithMap(userSkill, profileId, transaction);
                            })
                    });
                    return q.all(tasks);
            })
            .fail(function SkillDetailsFetchedError(error)
            {
                self.logger.error(error);
                throw(error);
            })
    }

    fetchBasicDetailsFromLinkedIn(userId:number, integrationId:number, profileId:number, transaction?:any):q.Promise<any>
    {
        var self = this;

        if (Utils.isNullOrEmpty(transaction))
            return MysqlDelegate.executeInTransaction(self, arguments);

        return q.all([
                self.fetchSelectedFieldsFromLinkedIn(userId, integrationId, UserProfileDelegate.BASIC_FIELDS, transaction),
                new IntegrationMemberDelegate().find({'user_id': userId, 'integration_id': integrationId})
            ])
            .then(function BasicDetailsFetched(...args)
            {
                var profile = args[0][0];
                var integrationMember:IntegrationMember = args[0][1];

                var userProfile:UserProfile = new UserProfile();
                userProfile.setShortDesc(profile.headline || '');
                userProfile.setLongDesc(profile.summary || '');
                userProfile.setIntegrationMemberId(integrationMember.getId());

                var user:User = new User();
                user.setFirstName(profile.firstName);
                user.setLastName(profile.lastName);
                if (!Utils.isNullOrEmpty(profile.dateOfBirth))
                {
                    var dob:string = profile.dateOfBirth.day + '-' + profile.dateOfBirth.month + '-' + profile.dateOfBirth.year;
                    user.setDateOfBirth(dob);
                }
                if (!Utils.isNullOrEmpty(profile.industry))
                {
                    var industry:string = profile.industry.toString().replace(/-|\/|\s/g, '_').toUpperCase();
                    user.setIndustry(IndustryCodes[industry]);
                }
                var UserDelegate = require('../delegates/UserDelegate');
                return q.all([
                    self.update({id: profileId}, userProfile, transaction),
                    new UserDelegate().update({id: userId}, user, transaction)
                ]);
            })
            .fail(function BasicDetailsFetchedError(error)
            {
                self.logger.error(error);
                throw(error);
            })
    }

    fetchAllDetailsFromLinkedIn(userId:number, integrationId:number, profileId:number, transaction?:any):q.Promise<any>
    {
        var self = this;

        if (Utils.isNullOrEmpty(transaction))
            return MysqlDelegate.executeInTransaction(self, arguments);

        return q.all([
            self.fetchBasicDetailsFromLinkedIn(userId, integrationId, profileId, transaction),
            self.fetchEducationDetailsFromLinkedIn(userId, integrationId, profileId, transaction),
            self.fetchEmploymentDetailsFromLinkedIn(userId, integrationId, profileId, transaction),
            self.fetchProfilePictureFromLinkedIn(userId, integrationId, profileId, transaction),
            self.fetchSkillDetailsFromLinkedIn(userId, integrationId, profileId, transaction)
        ]);
    }

    fetchAndReplaceEducation(userId:number, integrationId:number, profileId:number, transaction?:any):q.Promise<any>
    {
        var self = this;
        var userEducationDelegate = new UserEducationDelegate();

        if (Utils.isNullOrEmpty(transaction))
            return MysqlDelegate.executeInTransaction(self, arguments);

        return userEducationDelegate.search({'profileId': profileId})
            .then(function EducationFetched(userEducation:UserEducation[])
            {
                return q.all([
                        _.each(userEducation, function (edu)
                        {
                            return userEducationDelegate.delete({id: edu.getId(), profileId: profileId}, false, transaction)
                        })
                    ])
                    .then(function deleted()
                    {
                        return self.fetchEducationDetailsFromLinkedIn(userId, integrationId, profileId, transaction);
                    })
            })
    }

    fetchAndReplaceEmployment(userId:number, integrationId:number, profileId:number, transaction?:any):q.Promise<any>
    {
        var self = this;
        var userEmploymentDelegate = new UserEmploymentDelegate();

        if (Utils.isNullOrEmpty(transaction))
            return MysqlDelegate.executeInTransaction(self, arguments);

        return userEmploymentDelegate.search({'profileId': profileId})
            .then(function EmploymentFetched(userEmployment:UserEmployment[])
            {
                return q.all([
                        _.each(userEmployment, function (emp)
                        {
                            return userEmploymentDelegate.delete({id: emp.getId(), profileId: profileId}, false, transaction)
                        })
                    ])
                    .then(function deleted()
                    {
                        return self.fetchEmploymentDetailsFromLinkedIn(userId, integrationId, profileId, transaction);
                    })
            })
    }

    fetchAndReplaceSkill(userId:number, integrationId:number, profileId:number, transaction?:any):q.Promise<any>
    {
        var self = this;

        if (Utils.isNullOrEmpty(transaction))
            return MysqlDelegate.executeInTransaction(self, arguments);

        var userSkillDelegate = new UserSkillDelegate();
        return userSkillDelegate.search({'profileId': profileId})
            .then(function SkillFetched(userSkill:UserSkill[])
            {
                return q.all([
                        _.each(userSkill, function (skill)
                        {
                            return userSkillDelegate.delete({id: skill.getId(), profileId: profileId}, false, transaction)
                        })
                    ])
                    .then(function deleted()
                    {
                        return self.fetchSkillDetailsFromLinkedIn(userId, integrationId, profileId, transaction);
                    })
            })
    }

    publishProfile(profileId:number, userId:number, transaction?:any):q.Promise<any>
    {
        var self = this;

        if (Utils.isNullOrEmpty(transaction))
            return MysqlDelegate.executeInTransaction(self, arguments);

        var userProfile:UserProfile = new UserProfile();
        userProfile.setStatus(ProfileStatus.APPROVED);

        return self.update({id: profileId}, userProfile, transaction)
            .then(
            function userUpdated()
            {
                var UserDelegate = require('../delegates/UserDelegate');
                return new UserDelegate().recalculateStatus(userId, transaction)
            }
        )
    }

    copyProfile(profileId:number, newProfileId:number, transaction?:any):q.Promise<any>
    {
        var self = this;

        if (Utils.isNullOrEmpty(transaction))
            return MysqlDelegate.executeInTransaction(self, arguments);

        return q.all([
            new UserProfileDelegate().get(profileId),
            new UserSkillDelegate().getSkillWithName(profileId),
            new UserEducationDelegate().search({'profileId': profileId}),
            new UserEmploymentDelegate().search({'profileId': profileId}),
            new UserUrlDelegate().search({'profileId': profileId})
        ])
            .then( function detailsFetched(...args){
                var userProfile = args[0][0];
                var userSkills = args[0][1] || [];
                var userEducations = args[0][2] || [];
                var userEmployments = args[0][3] || [];
                var userUrls = args[0][4] || [];
                var createTasks = [];
                createTasks.push(new UserProfileDelegate().update({id:newProfileId}, userProfile,transaction));
                createTasks.push(_.each(userSkills,  function (skill:UserSkill){
                    return new UserSkillDelegate().createUserSkillWithMap(skill, newProfileId,transaction);
                }));
                createTasks.push(_.each(userEducations,  function (edu:UserEducation){
                    return new UserEducationDelegate().createUserEducation(edu,newProfileId,transaction);
                }));
                createTasks.push(_.each(userEmployments, function (emp:UserEmployment){
                    return new UserEmploymentDelegate().createUserEmployment(emp, newProfileId, transaction);
                }));
                createTasks.push(_.each(userUrls, function(url:UserUrl){
                    return new UserUrlDelegate().createUserUrl(url, newProfileId, transaction);
                }));
                return q.all(createTasks);
            })

    }

}
export = UserProfileDelegate