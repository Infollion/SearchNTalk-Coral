$(function() {
    var parts = location.pathname.split('/');
    if(parts[parts.length - 1] == 'login') {
        $('#loginInHeader').hide();
    }
});

$('#headerLoginModal form').validate({
    rules         : {
        username: { required: true},
        password : { required: true}
    },
    errorPlacement: function(error, element)
    {
        $(element).attr('title', error[0].innerHTML);
        $(element).tooltip('show');
    },
    highlight     : function(element)
    {
        $(element).closest('.form-group').addClass('has-error');
    },
    unhighlight   : function(element)
    {
        $(element).closest('.form-group').removeClass('has-error');
    },
    submitHandler : function()
    {
        $.ajax({
            url : '/login',
            type: 'post',
            contentType: 'application/json',
            dataType: 'json',
            data:JSON.stringify({
                username            : $('#headerLoginModal form #username').val(),
                password            : $('#headerLoginModal form #password').val()
            }),
            success: function()
            {
                location.reload();
            },
            error: function()
            {
                bootbox.alert('Login Failed');
            }

        })
    }

});