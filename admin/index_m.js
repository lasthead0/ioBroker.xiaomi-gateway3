/* global $, M, _, sendTo, systemLang, translateWord, translateAll, showMessage, showToast, socket, document, instance, vis, Option, supportsFeature */

function isArray(it) {
    if (typeof Array.isArray === 'function')
        return Array.isArray(it);

    return Object.prototype.toString.call(it) === '[object Array]';
}

const namespace = `xiaomi-gateway3.${instance}`;
var active = false;

// This will be called by the admin adapter when the settings page loads
function load(settings, onChange) {
    if (!settings) return;

    console.log('sett_'+ JSON.stringify(settings));

    /* html DOM elements JQuery selectors */
    const $selectedGateway = $('#selectedGateway');
    const $gatewaysList = $('#gatewaysList');
    const $selectTelnetCmd = $('#selectTelnetCmd');
    // const $enableTelnet = $('#enableTelnet');
    
    /* Fill selectedGateway with options */
    try {
        $selectedGateway.html(
            ['<option value="{}" class="translate" disabled selected>Choose Gateway</option>'].concat(
                JSON.parse(settings['gatewaysList'] || '[]')
                    .map(gw => `<option value=${JSON.stringify({token: gw.token, localip: gw.localip})}>${gw.model} - token: ${gw.token} - ip: ${gw.localip}</option>`)
            ).join('')
        );
    } catch (error) {
        console.log(error);
    }

    /* Apply config values to DOM elements */
    $('.value').each(function () {
        var $key = $(this);
        var id = $key.attr('id');
        
        if ($key.attr('type') === 'checkbox') {
            $key.prop('checked', settings[id])
                .on('change', () => onChange())
            ;
        } else {
            $key.val(settings[id])
                .on('change', () => onChange())
                .on('keyup', () => onChange())
            ;
        }

        onChange(false);
    });

    /* */
    $('#telnetCmd').attr('data-val', $('#telnetCmd').val());

    $(document).ready(function() {
        if (M) M.updateTextFields();
        if (M) M.Tabs.init($('.tabs'));
        if (M) M.FormSelect.init($selectedGateway);
    });

    /* 'get-devices' buttom on click event  */
    $('#get-devices').on('click', () => {
        const $this = $('#get-devices');
        const $loader = $('#loader1');

        const email = $('#email').val();
        const password = $('#password').val();
        const server = $('#server').val();

        if (!active) {
            console.log('Not_active');
            showToast(_('Please activate instance first'));

            return;
        }

        if (server == undefined || server == '') {
            $this.removeClass('disabled');
            $loader.addClass('hidden');
            showToast(_('Select server'));

            return;
        }

        $this.addClass('disabled');
        $loader.removeClass('hidden');

        sendTo(namespace, 'GetGatewayFromCloud', {email, password, server}, function (msg) {
            if (isArray(msg) && msg.length != 0) {
                console.log('\'GetGatewayFromCloud\' return [...]');
                showToast(_('Successful getting devices'));

                $gatewaysList.val(JSON.stringify(msg));

                try {
                    $selectedGateway.html(
                        ['<option value="{}" class="translate" disabled selected>Choose Gateway</option>'].concat(
                            msg.map(gw => `<option value=${JSON.stringify({token: gw.token, localip: gw.localip})}>${gw.model} - token: ${gw.token} - ip: ${gw.localip}</option>`)
                        ).join('')
                    );
                } catch (error) {
                    console.log(error);
                }

                if (M) M.FormSelect.init($selectedGateway);
            } else if (msg instanceof String || typeof msg == 'string') {
                console.log(msg);
                showToast(_(msg));
            }

            $this.removeClass('disabled');
            $loader.addClass('hidden');
        });
    });

    /* 'ping-device' button on click event */
    $('#ping-device').on('click', () => {
        let $this = $('#ping-device');
        const $loader = $('#loader2');

        const localip = $('#localip').val();

        if (localip == undefined || localip == '') {
            $this.removeClass('disabled');
            $loader.addClass('hidden');
            showToast(_('You have to set IP address first'));

            return;
        }

        $this.addClass('disabled');
        $loader.removeClass('hidden');

        sendTo(namespace, 'PingGateway3', {localip}, function (msg) {
            $this.removeClass('disabled');
            $loader.addClass('hidden');

            showToast(msg ? _('Gateway 3 available') : _('Gateway 3 unavailable'));
        });
    });

    /* 'check-telnet' button on click event */
    $('#check-telnet').on('click', () => {
        let $this = $('#check-telnet');
        const $loader = $('#loader2');

        const localip = $('#localip').val();

        if (localip == undefined || localip == '') {
            $this.removeClass('disabled');
            $loader.addClass('hidden');
            showToast(_('You have to set IP address first'));
            
            return;
        }

        $this.addClass('disabled');
        $loader.removeClass('hidden');

        sendTo(namespace, 'CheckTelnet', {localip}, function (msg) {
            $this.removeClass('disabled');
            $loader.addClass('hidden');

            showToast(msg ? _('Gateway 3 telnet opened') : _('Gateway 3 telnet closed'));
        });
    });

    /* Telnet command select on change event */
    $selectTelnetCmd.on('change', function () {
        const val = $(this).val();
        const cmds = [
            undefined,
            '{"id":0,"method":"enable_telnet_service", "params":[]}',
            '{"id":0,"method":"set_ip_info","params":{"ssid":"\\"\\"","pswd":"123123 ; passwd -d admin ; echo enable > /sys/class/tty/tty/enable; telnetd"}}'
        ];

        if (val != 0) {
            const cmd = cmds[val];

            $('#telnetCmd').val(cmd);
            $('#telnetCmd').attr('data-val', cmd);
        }

        onChange();
    });

    /* 'telnetCmd' on change event */
    $('#telnetCmd').on('keyup', function () {
        const oldValue = $(this).attr('data-val');
        const newValue = $(this).val();

        $(this).attr('data-val', newValue);
        if (newValue != oldValue) {
            $selectTelnetCmd.find('option[value=0]').prop('selected', true);
            if (M) M.FormSelect.init($selectTelnetCmd);
        }
    });
     
    /* GW select on change event */
    $selectedGateway.on('change', function () {
        let obj = JSON.parse($(this).val());

        $('#token').val(obj.token);
        $('#localip').val(obj.localip);

        onChange();
    });

    /* 'localip' and 'token' on change event */
    $('#token, #localip').on('keyup', () => {
        $selectedGateway.find('option[value="{}"]').prop('selected', true);
        if (M) M.FormSelect.init($selectedGateway);
    });

    /* On 'debugLog' checkbox change */
    $('.debugLog').prop('disabled', $('#debugLog').prop('checked') == false);
    $('#debugLog').on('change', function() {
        const val = $(this).prop('checked');

        $('.debugLog').each(function() {
            $(this).prop('disabled', !val);
        });
    });

    onChange(false);
}

/* */
socket.emit('getState', `system.adapter.${namespace}.alive`, function (err, state) {
    active = /*common.enabled ||*/ (state && state.val);
});

/* DO NOT ANY CHANGES */
// This will be called by the admin adapter when the user presses the save button
function save(callback) {
    // example: select elements with class=value and build settings object
    var obj = {};

    $('.value').each(function () {
        let $this = $(this);
        var id = $this.attr('id');

        if ($this.attr('type') === 'checkbox')
            obj[id] = $this.prop('checked');
        else if ($this.attr('type') === 'number')
            obj[id] = parseFloat($this.val());
        else
            obj[id] = $this.val();
    });

    callback(obj);
}
