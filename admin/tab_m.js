/* global $, M, _, sendTo, systemLang, translateWord, translateAll, showMessage, showToast, socket, document, instance, vis, Option, supportsFeature, Shuffle */

function isArray(it) {
    if (typeof Array.isArray === 'function')
        return Array.isArray(it);

    return Object.prototype.toString.call(it) === '[object Array]';
}

const namespace = `xiaomi-gateway3.${instance}`;
var active = false;

/* Define variables */
let 
    devices = {},
    shuffleInstance;

// This will be called by the admin adapter when the settings page loads
async function load(settings, onChange) {
    if (!settings) return;

    /*  */
    $(document).ready(function() {
        if (M) M.Tabs.init($('.tabs'));
        if (M) M.Modal.init($('.modal'), {});
    });

    /*  */
    $('#reload-stat').on('click', () => {
        const $this = $('#reload-stat');
        const $loader = $('#loader1');
        
        $this.addClass('disabled');
        $loader.removeClass('hidden');

        sendTo(namespace, 'GetMessagesStat', {}, function (msgStatObjects) {
            if (!isArray(msgStatObjects)) return;
            
            const $tableBody = $('#table-stats > tbody');

            if (msgStatObjects.length != 0) {
                $tableBody.empty();

                for (let statObject of msgStatObjects) {
                    let tr = $('<tr></tr>');

                    tr.append(`<td>${statObject.name}</td>`);
                    tr.append(`<td>${statObject.did}</td>`);
                    tr.append(`<td>${statObject.nwk}</td>`);
                    tr.append(`<td>${statObject.received}</td>`);
                    tr.append(`<td>${statObject.missed}</td>`);
                    tr.append(`<td>${statObject.unresponsive}</td>`);
                    tr.append(`<td>${statObject.lqi}</td>`);
                    tr.append(`<td>${statObject.rssi}</td>`);
                    tr.append(`<td>${statObject.lastSeen}</td>`);

                    $tableBody.append(tr);
                }
            }

            $this.removeClass('disabled');
            $loader.addClass('hidden');
        });
    });

    /*  */
    $('#clear-stat').on('click', () => {
        const $this = $('#clear-stat');
        const $loader = $('#loader1');
        
        $this.addClass('disabled');
        $loader.removeClass('hidden');

        sendTo(namespace, 'ClearMessagesStat', {}, function () {
            const $tableBody = $('#table-stats > tbody');

            $tableBody.empty();

            const td = Array.from({length: 9}).fill(`<td>?</td>`);
            let tr = $('<tr></tr>').append(td.join('\n'));

            $tableBody.append(tr);

            $this.removeClass('disabled');
            $loader.addClass('hidden');
        });
    });

    /*  */
    await getDevices();
    showDevices();

    /* Hook control changes */
    $(`.state > .control input[type='checkbox']`).change(function (event) {
        const id = $(this).parents('.state').data('oid');
        const value = $(this).is(':checked');

        sendTo(namespace, 'SetStateValue', {id, value}, function (data) {});
    });

    $(`.state > .control select`).change(function (event) {
        const id = $(this).parents('.state').data('oid');
        const val = $(this).val();
        
        const valDigMatch = val.match(/\d*/g);

        if (valDigMatch.length > 0)
            var value = Number(valDigMatch[0]);
        else
            var value = val;

        sendTo(namespace, 'SetStateValue', {id, value}, function (data) {});
    });

    $(`.state > .control input[type="range"]`).change(function (event) {
        const id = $(this).parents('.state').data('oid');
        const value = Number($(this).val());

        sendTo(namespace, 'SetStateValue', {id, value}, function (data) {});
    });
    
    /* Open modal for device friendly name editing */
    $(`a.open-rename`).click(function (event) {
        const $trigger = $(event.target);

        const instance = M.Modal.getInstance($('#modal_rename'));
        const $modal = $(instance.el);

        const id = $trigger.data('oid');
        const friendlyName = $trigger.parents('div.device').data('friendly-name');

        $modal.data('oid', id);
        $modal.find('#friendly_name_input').val(friendlyName);
        
        if (M) M.updateTextFields();
        
        instance.open();
    });

    /* Apply friendly name object */
    $(`a.apply-rename`).click(function (event) {
        const $el = $(event.target);
        const $modal = $el.parents('#modal_rename');

        const id = $modal.data('oid');
        const name = $modal.find('#friendly_name_input').val();
        
        sendTo(namespace, 'ModifyDeviceObject', {id, object: {name}}, function (data) {});
    });

    /* Open modal for device friendly name editing */
    $(`a.open-yaml`).click(function (event) {
        const $trigger = $(event.target);
        
        const instance = M.Modal.getInstance($('#modal_yaml'));
        const $modal = $(instance.el);

        const id = $trigger.data('oid');
        const file = id.split('.').pop() + '.yaml';
       
        sendTo(namespace, 'ReadFromFile', {file}, function (data) {
            if (data == undefined || data == 'ReadFromFile')
                $modal.find('#yaml_input').val('');
            else
                $modal.find('#yaml_input').val(data);

            if (M) M.updateTextFields();
        });

        $modal.data('oid', id);

        instance.open();
    });

    $(`a.apply-yaml`).click(function (event) {
        const $el = $(event.target);
        const $modal = $el.parents('#modal_yaml');

        const id = $modal.data('oid');
        const file = id.split('.').pop() + '.yaml';
        const data = $modal.find('#yaml_input').val();
        
        sendTo(namespace, 'WriteToFile', {file, data}, function (data) {});
    });

    /*  */
    onChange(false);
}

/* Get devices function */
async function getDevices(ids/* Array */) {
    await new Promise(resolve => {
        sendTo(namespace, 'GetDevices', {ids}, function (msg) {
            if (isArray(msg)) {
                const _devices = msg
                    .sort((a, b) => {
                        if (a.type == 'gateway') {
                            return -1;
                        } else if (b.type == 'gateway') {
                            return 1;
                        } else {
                            const aInt = a.mac.match(/[\da-f]{2}/g).reduce((acc, c) => acc + parseInt(c, 16), 0);
                            const bInt = b.mac.match(/[\da-f]{2}/g).reduce((acc, c) => acc + parseInt(c, 16), 0);
                            return bInt - aInt;
                        }
                    })
                    .reduce((acc, d) => Object.assign(acc, {[d.id]: d}), {});

                devices = Object.assign(devices, _devices);
            }
            resolve();
        });
    }); 
}

function showDevices() {   
    const html = Object.values(devices).map(device => {
        const {id, mac, type, did, model, name, fwVer, friendlyName, stateVal, stateCommon} = device;

        // if (type == 'gateway') return '';

        let img_src = '';
        
        if (['lumi', 'zigbee'].includes(type))
            img_src = `https://www.zigbee2mqtt.io/images/devices/${model}.jpg`;
        else if (type === 'ble')
            img_src = `https://custom-components.github.io/ble_monitor/assets/images/${model}.jpg`;

        const ulContentStates = Object.keys(stateCommon)
            .map(sn => {
                const {name, role, type, write, min, max, unit, states} = stateCommon[sn];
                const value = stateVal[sn];

                let html = '';

                if (role === 'switch' && write == true) {
                    html = `<div class="control switch"><div>
                            <label>
                                <input type="checkbox" ${value ? 'checked' : ''}>
                                <span class="lever"></span>
                            </label>
                        </div></div>`;
                } else if (type === 'boolean') {
                    html = `<div class="control check"><div>
                            <label>
                                <input type="checkbox" class="filled-in" ${value ? 'checked="checked"' : ''} ${write ? '' : 'disabled="disabled"'}/>
                                <span/>
                            </label>
                        </div></div>`;
                } else if (states != undefined && write == true) {
                    const options = Object.keys(states).map(k => {
                        return `<option value="${k}" ${(value == k) ? 'selected' : ''}>${states[k]}</option>`;
                    });

                    html = `<div class="control select"><div style="width: 100%;">
                            <select class="browser-default enum" style="height: 16px; padding: 0px; width: 100%; display: inline-block">${options.join('')}</select>
                        </div></div>`;
                } else if (String(role).match(/level\.?.*/g) != null && write == true) {
                    html = `<div class="control range"><div style="width: 100%;">
                            <span class="range-field">
                                <input type="range" min="${min || 0}" max="${max || 100}" ${(value != undefined) ? `value="${value}"` : ''}/>
                            </span>
                        </div></div>`;
                } else {
                    if (states != undefined)
                        var val = states[value];
                    else
                        var val = value;

                    html = `<div class="value"><div>
                            <span>${val != undefined ? `${val}${unit ? ` ${unit}` : ''}` : ''}</span>
                        </div></div>`;
                }

                return `<li style="margin-bottom: 2px;">
                        <div id="${id}_${sn}" class="state" data-oid="${namespace}.${id}.${sn}">
                            <div>
                                <span>${name}</span>
                            </div>
                            ${html}
                        </div>
                    </li>`;
            })
            .join('');

        const ulContentDetails = [
            ['did', did],
            ['mac', mac],
            ['model', model],
            ['name', name],
            ['fwVer', fwVer]
        ]
            .map(([name, value]) => `
                <li style="margin-bottom: 2px;">
                    <div class="detail">
                        <div>
                            <span>${name}</span>
                        </div>
                        <div>
                            <span>${value}</span>
                        </div>
                    </div>
                </li>`
            )
            .join('');

        const card = `<div id="${id}" class="device" data-friendly-name="${friendlyName}">
            <div class="card dcard">
                <div class="card-content">
                    <div class="card-header">
                        <div id="friendly_name" class="card-title truncate" style="margin-right: 5px;">${friendlyName}</div>
                        <div class="info">
                            ${stateVal.battery != undefined ? `
                                <div id="${id}_battery" class="col el" style="padding-right: 0;">
                                    <i class="material-icons" style="font-size: 24px;">battery_full</i>
                                    <div class="center">${stateVal.battery}</div>
                                </div>
                            ` : ''}
                            ${stateVal.link_quality != undefined ? `
                                <div id="${id}_link_quality" class="col el">
                                    <i class="material-icons">network_check</i>
                                    <div class="center">${stateVal.link_quality}</div>
                                </div>
                            ` : ''}
                            ${stateVal.available != undefined ? `
                                <div id="${id}_available" class="col el">
                                    <i class="material-icons" style="color: ${stateVal.available ? '#43a047' : '#f44336'};">${stateVal.available ? 'cloud_queue' : 'cloud_off'}</i>
                                    <div class="center">&nbsp;</div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div style="height: 100%;">
                        <ul style="margin: 0px;">${ulContentStates}</ul>
                    </div>
                </div>
                <div class="card-action">
                    <div style="margin-left: auto;">
                        <span class="card-title activator grey-text text-darken-4"><i class="material-icons right">more_vert</i></span>
                    </div>
                </div>
                <div class="card-reveal">
                    <div>
                        <div class="card-title card-header">
                            <div id="friendly_name" class="card-title truncate" style="margin-right: 5px;">${friendlyName}</div>
                            <div style="margin-left: auto;">
                                <i class="material-icons right">close</i>
                            </div>
                        </div>
                        <div>
                            <div style="height: 100%;">
                                <img src="${img_src}" width="65px" onerror="this.onerror=null;this.src='img/noimage.png';">
                            </div>
                            <div style="flex-grow: 1; margin-left: 10px;">
                                <ul style="margin: 0px;">${ulContentDetails}</ul>
                            </div>
                        </div>
                        <div class="card-footer">
                            <div style="margin-left: auto;">
                                <!-- Dropdown Trigger -->
                                <a href="#" class="dropdown-trigger grey-text text-darken-4" data-target="dropdown_${id}"><i class="material-icons">more_vert</i></a>
                            </div>
                            <!-- Dropdown Structure -->
                            <ul id="dropdown_${id}" class="dropdown-content">
                                <li><a href="#!" class="green-text text-darken-3 open-rename" data-oid="${namespace}.${id}"><i class="material-icons">edit</i>${translateWord('Rename')}</a></li>
                                <li><a href="#!" class="blue-text text-darken-3 open-yaml" data-oid="${namespace}.${id}"><i class="material-icons">subject</i>${translateWord('Config')}</a></li>
                                <!-- <li class="divider" tabindex="-1"></li> -->
                                <!-- <li><a id="a_delete_${id}" href="#!" class="red-text text-darken-3"><i class="material-icons">delete</i>delete</a></li> -->
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

        return card;
    }).join('');

    /*  */
    $('#devices').html(html);

    /*  */
    if (M) M.Dropdown.init($('.dropdown-trigger'), {coverTrigger: false});

    /*  */
    for (let device of Object.values(devices)) {
        const {id, stateVal} = device;

        const infoStates = Object.keys(stateVal)
            .filter(s => ['available', 'link_quality', 'battery'].includes(s));
        
        for (let state of infoStates) {
            ({
                link_quality: updateLinkQuality,
                battery: updateBattery,
                available: updateAvailable 
            })[state](id, stateVal[state]);
        }
    }

    /*  */
    shuffleInstance = new Shuffle($('#devices'), {
        itemSelector: '.device',
        sizer: '.js-shuffle-sizer',
    });
}

// subscribe to changes
socket.emit('subscribe', namespace + '.*');
// socket.emit('subscribeObjects', namespace + '.*');

socket.on('stateChange', function (id, state) {
    if (id.substring(0, namespace.length) !== namespace)
        return;

    const [_id, _state] = id.split('.').splice(-2);

    if (['debug_output', 'messages_stat', 'connection'].includes(_state))
        return;
    
    if (state != undefined && devices[_id] != undefined) {
        const {val: value} = state;

        /* Set new value to state */
        devices[_id].stateVal[_state] = value;

        if (['available', 'link_quality', 'battery'].includes(_state) == false) {
            if (!Object.keys(devices[_id].stateCommon).includes(_state))
                return;

            const {role, type, write, states, unit} = devices[_id].stateCommon[_state];
            const $el = $(`#${_id}_${_state}`);

            if (type === 'boolean') {
                $el.find('input[type="checkbox"]').prop('checked', value);
            } else if (states != undefined && write) {
                $el.find(`select option[value=${value}]`).prop('selected', true);
            } else if (String(role).match(/level\.?.*/g) != null && write == true) {
                $el.find('input[type="range"]').prop('value', value);
            } else {
                if (states != undefined)
                    var val = states[value];
                else
                    var val = value;
                
                $el.find('.value span').text(`${val}${unit ? ` ${unit}` : ``}`);
            }
        } else if (_state === 'available') {
            updateAvailable(_id, value);
        } else if (_state === 'link_quality') {
            updateLinkQuality(_id, value);
        } else if (_state === 'battery') {
            updateBattery(_id, value);
        }
    }
});

socket.on('objectChange', async function (id, object) {
    if (id.substring(0, namespace.length) !== namespace)
        return;

    const [_id] = id.split('.').splice(-1);
    const _device = devices[_id];

    if (object != undefined && _device != undefined) {
        if (object.type == 'device'/*  && obj.common.type !== 'group' */) {
            if (_device.name !== object.common.name) {
                await getDevices([_device.did]);
                renameDevice(_id);
            }
        }
    }
});

/*  */
function renameDevice(id) {
    const {friendlyName} = devices[id];

    const $device = $(`#${id}.device`);

    $device.find('div#friendly_name').text(friendlyName);
    $device.data('friendly-name', friendlyName);
}

function updateAvailable(id, val) {
    const $el = $(`#${id}_available`);

    $el.find('i').text(val? 'cloud_queue' : 'cloud_off');
    $el.find('i').css('color',val ? '#43a047' : '#f44336');
}

function updateLinkQuality(id, val) {
    const style = () => {
        if (val > 125)
            return '#000000';
        else if (val > 50)
            return '#fdd835';
        else
            return '#f44336';
    };
    
    const $el = $(`#${id}_link_quality`);

    $el.find('div').text(val);
    $el.find('i').css('color', style());
}

function updateBattery(id, val) {
    const style = () => {
        if (val > 50)
            return '#000000';
        else if (val > 25)
            return '#fdd835';
        else
            return '#f44336';
    };
    
    const $el = $(`#${id}_battery`);

    $el.find('div').text(val);
    $el.find('i').css('color', style());
}

/* DO NOT ANY CHANGES */
// This will be called by the admin adapter when the user presses the save button
function save(callback) {
    console.error('You can\' save from tab');
}