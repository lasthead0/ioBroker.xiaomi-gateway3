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

    $(document).ready(function() {
        if (M) M.Tabs.init($('.tabs'));
    });

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

            // tr.append(td.join('\n'));

            $tableBody.append(tr);

            $this.removeClass('disabled');
            $loader.addClass('hidden');
        });
    });

    onChange(false);
}

/* DO NOT ANY CHANGES */
// This will be called by the admin adapter when the user presses the save button
function save(callback) {
    console.error('You can\' save from tab');
}