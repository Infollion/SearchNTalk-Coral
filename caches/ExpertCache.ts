import q                        = require('q');
import CacheHelper              = require('./CacheHelper');

class ExpertCache
{
    /*
     * Get information required to render expert widget
     * Ratings, pricing
     * @param expertId
     */
    getWidgetProfile(expertId:string):q.Promise<any>
    {
        return CacheHelper.get(expertId);
    }

}
export = ExpertCache