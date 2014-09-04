import _                                            = require('underscore');
import q                                            = require('q');
import BaseDaoDelegate                              = require('../delegates/BaseDaoDelegate');
import SkillCodeDelegate                            = require('../delegates/SkillCodeDelegate');
import MapExpertiseSkill                            = require('../models/MapExpertiseSkill');
import SkillCode                                    = require('../models/SkillCode');

class MapExpertiseSkillDelegate extends BaseDaoDelegate
{
    constructor() { super(MapExpertiseSkill); }
}
export = MapExpertiseSkillDelegate