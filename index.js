var argv = require('optimist')
        .usage('Usage: $0 -id [str]')
        .demand(['id'])
        .argv,
    request = require('request-promise'),
    util = require('util'),
    Q = require('q'),
    _ = require('underscore');

var friendsUrlFormat = 'https://api.vk.com/method/friends.get?user_id=%s&v=5.29',
    audioUrlFormat = 'https://api.vk.com/method/audio.get?owner_id=%s&v=5.29';

var curLevel = 0,
    maxLevel = 1,
    artist = 'stas mikhailov',
    resultUserMaxCount = 5,
    userIds = [];

var getFriendsIds = function (id) {
    var url = util.format(friendsUrlFormat, id);
    return request(url)
        .then(function (result) {
            var res = JSON.parse(result);

            if (res.error) {
                console.error(res.error.error_msg);
                return [];
            }

            return res.response.items;
        })
        .catch(function (error) {
            console.error(error);
            return [];
        });
};

var getFriendsIdsParallel = function (ids) {
    return Q.all(ids.map(getFriendsIds)).then(function (results) {
        curLevel++;

        var mergedIds = _.flatten(results)

        console.log(mergedIds.length + ' friends on the ' + curLevel + ' level');
        userIds = userIds.concat(mergedIds);
        if (curLevel < maxLevel)
            return getFriendsIdsParallel(mergedIds);
        else
            return userIds;
    });
};

var getUserAudioList = function (id) {
    var url = util.format(audioUrlFormat, id);
    return request(url)
        .then(function (result) {
            var res = JSON.parse(result);

            if (res.error) {
                console.error(res.error.error_msg);
                return [];
            }

            return res.response.items;
        })
        .catch(function (error) {
            console.error(error);
            return [];
        });
};

var getUsersAudioListParallel = function (ids) {
    var uniqueIds = _.uniq(ids);

    console.log('Friends count: ' + uniqueIds.length);

    return Q.all(uniqueIds.map(getUserAudioList)).then(function (results) {
        var result = _.chain(results)
            .flatten(results)
            .filter(function (item) {
                return item.artist.toLowerCase() === artist;
            })
            .countBy('owner_id')
            .map(function (val, key) {
                return {
                    userId: key,
                    audioCount: val
                };
            })
            .sortBy('audioCount')
            .reverse()
            .first(resultUserMaxCount)
            .map(function (item) {
                return item.userId;
            })
            .value();

        return result;
    });
};

getFriendsIdsParallel([argv.id])
    .then(getUsersAudioListParallel)
    .then(function (result) {
        console.log(util.format('Top users with "%s" in their play lists:', artist));
        console.log(result.join(',') || 'There are no users');
    })
    .fail(function (error) {
        console.error(error);
    });