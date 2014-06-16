$('.schedule .editScheduleBtn').click(function(event)
{
    $('#scheduleDetails').show();
    $('#schedule').hide();

    var ruleId = $(event.currentTarget).data('id');
    var rule = _.findWhere(rules, {id: ruleId});

    $('#scheduleDetails').data('id', ruleId);
    $('#scheduleDetails li').removeClass('active');

    var daysOfWeek = rule.values[5];
    _.each(daysOfWeek, function(index)
    {
        $($('#scheduleDetails li')[parseInt(index)]).addClass('active');
    });

    $('#scheduleDetails #startTime').val(moment().hour(rule.values[2]).minute(rule.values[1]).format('hh:mm a'));
    $('#scheduleDetails #endTime').val(moment().hour(rule.values[2]).minute(rule.values[1]).add({milliseconds: rule.duration}).format('hh:mm a'));

});

$('#createScheduleBtn').click(function(event)
{
    $('#scheduleDetails').show();
    $('#schedule').hide();

    $('#scheduleDetails').removeAttr('data-id');
    $('#scheduleDetails .datepicker').val(null);
    $('#scheduleDetails li').removeClass('active');
});

$('.done-editing-schedules').click(function()
{
    var startTime = moment($('#scheduleDetails #startTime').val(), 'hh:mm a');
    var hours = moment(startTime).hour();
    var minutes = moment(startTime).minute();

    var endTime = moment($('#scheduleDetails #endTime').val(), 'hh:mm a');
    var duration = moment(endTime).diff(startTime).valueOf();

    var daysOfWeek = [];
    for (var i = 0; i < 7; i++) {
        var element = $('#scheduleDetails li')[i];
        if ($(element).hasClass('active'))
            daysOfWeek.push(i);
    }

    var values = ['*', minutes, hours, daysOfWeek, '*', '*'];
    var cronPattern = fromValues(values);

    var scheduleRuleId = $('#scheduleDetails').data('id');
    var method = scheduleRuleId ? 'post' : 'put';
    var url = scheduleRuleId ? '/rest/scheduleRule/' + scheduleRuleId : '/rest/scheduleRule';

    $.ajax({
        url        : url,
        method     : method,
        dataType   : 'json',
        contentType: 'application/json',
        data       : JSON.stringify({
            'scheduleRule': {
                duration : duration,
                cron_rule: cronPattern
            }
        }),
        success    : function()
        {
            location.reload();
        }
    })
});

$('.datepicker').datetimepicker({
    pickDate      : false,
    useSeconds    : false,
    minuteStepping: 15
});

$('#scheduleDetails li').click(function(event)
{
    $(event.currentTarget).toggleClass('active');
});

$('#cancelScheduleDetails').click(function()
{
    $('#scheduleDetails').hide();
    $('#schedule').show();
});

function fromValues(values)
{
    return _.map(values, function(vals)
    {
        return valuesToPattern(vals);
    }).join(' ');
}

function valuesToPattern(values)
{
    if (values == null || values == undefined)
        return '*';
    else
        if (_.isArray(values))
            return values.join(',');
        else
            return values;
}