/*
This is the Scratch 3 extension to remotely control an
Arduino Uno, ESP-8666, or Raspberry Pi


 Copyright (c) 2019 Alan Yorinks All rights reserved.

 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
 Version 3 as published by the Free Software Foundation; either
 or (at your option) any later version.
 This library is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 General Public License for more details.

 You should have received a copy of the GNU AFFERO GENERAL PUBLIC LICENSE
 along with this library; if not, write to the Free Software
 Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 */

// Boiler plate from the Scratch Team
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const formatMessage = require('format-message');

require('sweetalert');

let lastDataSample = [0, 0, 0, 0, 0, 0, 0, 0];

let connection_pending = false;

// general outgoing websocket message holder
let msg = null;

// flag to indicate if the user connected to a board
let connected = false;

// flag to indicate if a websocket connect was
// ever attempted.
let connect_attempt = false;

// an array to buffer operations until socket is opened
let wait_open = [];

let the_locale = null;

/* map of sensors to indices for ALL_SENSORS
["Slider", "Light", "Sound", "Button", "A", "B", "C", "D"]
The key is the same used by the gateway when
values are published to the extension.
data value 0 = D  analog inverted logic
data value 1 = C  analog inverted logic
data value 2 = B  analog inverted logic
data value 3 = Button  digital inverted logic
data value 4 = A  analog inverted logic
data value 5 = Light  analog inverted logic
data value 6 = sound  analog
data value 7 = slider analog
*/
let theAllSensorMap =

    {0: 7, 1: 5, 2: 6, 3: 3, 4: 4, 5: 2, 6: 1, 7: 0};

/* map of sensors to indices for NON_BUTTON_SENSORS
["Slider", "Light", "Sound", "A", "B", "C", "D"]
values are published to the extension.
data value 0 = D  analog inverted logic
data value 1 = C  analog inverted logic
data value 2 = B  analog inverted logic
data value 3 = Button  digital inverted logic
data value 4 = A  analog inverted logic
data value 5 = Light  analog inverted logic
data value 6 = sound  analog
data value 7 = slider analog
*/

let theNonButtonSensorMap =
    //
    {0: 7, 1: 5, 2: 6, 3: 4, 4: 2, 5: 1, 6: 0};

// flag to indicate alert already generated
let alerted = false;

// General Alert
const FormWSClosed = {
    'en': "WebSocket Connection Is Closed.",
    'zh-tw': "??????????????????",
    'zh-cn': "??????????????????",
    'pt-br': "A Conex??o do WebSocket est?? Fechada",
    'pt': "A Conex??o do WebSocket est?? Fechada",
    'fr': "Connexion WebSocket Ferm??e.",
    'pl': "Po????czenie WebSocket jest zamkni??te.",
    'ja': "??????????????????????????????????????????????????????",
};

const MENU_NON_BUTTON_SENSORS = {
    'en': ["Slider", "Light", "Sound", "A", "B", "C", "D"],
    'zh-tw': ["??????", "??????", "??????", "A", "B", "C", "D"],
    'zh-cn': ["??????", "??????", "??????", "A", "B", "C", "D"],
    'pt-br': ["Controle deslizante", "Luz", "Som", "A", "B", "C", "D"],
    'pt': ["Controle deslizante", "Luz", "Som", "A", "B", "C", "D"],
    'fr': ["Glissi??re", "Lumi??re", "Son", "A", "B", "C", "D"],
    'pl': ["Suwak", "??wiat??o", "D??wi??k", "A", "B", "C", "D"],
    'ja': ["???????????????", "??????", "??????", "A", "B", "C", "D"],
};

const MENU_ALL_SENSORS = {
    'en': ["Slider", "Light", "Sound", "Button", "A", "B", "C", "D"],
    'zh-tw': ["??????", "??????", "??????", "??????", "A", "B", "C", "D"],
    'zh-cn': ["??????", "??????", "??????", "??????", "A", "B", "C", "D"],
    'pt-br': ["Controle deslizante", "Luz", "Som", "Bot??o", "A", "B", "C", "D"],
    'pt': ["Controle deslizante", "Luz", "Som", "Bot??o", "A", "B", "C", "D"],
    'fr': ["Glissi??re", "Lumi??re", "Son", "Bouton", "A", "B", "C", "D"],
    'pl': ["Suwak", "??wiat??o", "D??wi??k", "Przycisk", "A", "B", "C", "D"],
    'ja': ["???????????????", "??????", "??????", "???????????????", "A", "B", "C", "D"],
};

const MENU_COMPARISONS = {
    'en': ['>', '<'],
    'zh-tw': ['>', '<'],
    'zh-cn': ['>', '<'],
    'pt-br': ['>', '<'],
    'pt': ['>', '<'],
    'fr': ['>', '<'],
    'pl': ['>', '<'],
    'ja': ['>', '<'],
};

const MENU_BUTTON_STATES = {
    'en': ["pressed", "released"],
    'zh-tw': ["?????????", "?????????"],
    'zh-cn': ["?????????", "?????????"],
    'pt-br': ["pressionado", "liberado"],
    'pt': ["pressionado", "liberado"],
    'fr': ["appuy??", "relach??"],
    'pl': ["wci??ni??ty", "zwolniony"],
    'ja': ["??????", "??????"],
};

const FormBetween = {
    'en': 'When [SENSOR] value is between [LOW] and [HIGH]',
    'zh-tw': '??? [SENSOR] ?????????????????? [LOW] ??? [HIGH] ??????',
    'zh-cn': '??? [SENSOR] ?????????????????? [LOW] ??? [HIGH] ??????',
    'pt-br': 'Quando [SENSOR] estiver entre [LOW] e [HIGH]',
    'pt': 'Quando [SENSOR] estiver entre [LOW] e [HIGH]',
    'fr': 'Si la valeur de [SENSOR] est entre [LOW] et [HIGH]',
    'pl': 'Kiedy warto???? [SENSOR] jest pomi??dzy [LOW] i [HIGH]',
    'ja': '[SENSOR] ??? [LOW] ??? [HIGH] ???????????????',
};

const FormComparison = {
    'en': 'When [SENSOR] [COMP] [VALUE].',
    'zh-tw': '??? [SENSOR] ???????????? [COMP] [VALUE]',
    'zh-cn': '??? [SENSOR] ???????????? [COMP] [VALUE]',
    'pt-br': 'Quando [SENSOR] for [COMP] que [VALUE]',
    'pt': 'Quando [SENSOR] for [COMP] que [VALUE]',
    'fr': 'si [SENSOR] [COMP] [VALUE].',
    'pl': 'Kiedy [SENSOR] [COMP] [VALUE].',
    'ja': '[SENSOR] ??? [COMP] [VALUE] ?????????',
};

const FormButton = {
    'en': 'When Button [STATE].',
    'zh-tw': '????????? [STATE]',
    'zh-cn': '????????? [STATE]',
    'pt-br': 'Quando o bot??o estiver [STATE].',
    'pt': 'Quando o bot??o estiver [STATE].',
    'fr': 'Si Bouton [STATE].',
    'pl': 'Kiedy przycisk jest [STATE].',
    'ja': '?????????????????? [STATE] ?????????',
};

const FormIsButtonPressed = {
    'en': 'Is Button Pressed?',
    'zh-tw': '??????????????????',
    'zh-cn': '??????????????????',
    'pt-br': 'O bot??o est?? pressionado?',
    'pt': 'O bot??o est?? pressionado?',
    'fr': 'Bouton appuy?? ?',
    'pl': 'Czy przycisk jest wci??ni??ty?',
    'ja': '????????????????????????????',
};

const FormIsSensorComparison = {
    'en': 'Is [SENSOR] [COMP] [VALUE] ?',
    'zh-tw': '[SENSOR] ???????????? [COMP] [VALUE] ???',
    'zh-cn': '[SENSOR] ???????????? [COMP] [VALUE] ???',
    'pt-br': '[SENSOR] est?? [COMP] [VALUE] ?',
    'pt': '[SENSOR] est?? [COMP] [VALUE] ?',
    'fr': 'Est-ce que [SENSOR] [COMP] [VALUE] ?',
    'pl': 'Czy [SENSOR] [COMP] [VALUE] ?',
    'ja': '[SENSOR] ??? [COMP] [VALUE] ????',
};

const FormCurrentSensorValue = {
    'en': '[SENSOR] current value.',
    'zh-tw': '[SENSOR] ????????????',
    'zh-cn': '[SENSOR] ????????????',
    'pt': 'Ler valor atual: [SENSOR]',
    'pt-br': 'Ler valor atual: [SENSOR]',
    'fr': 'valeur actuelle de [SENSOR].',
    'pl': 'Aktualna warto???? [SENSOR].',
    'ja': '[SENSOR] ????????????',
};

const FormRangeConverter = {
    'en': 'Convert [SENSOR] value to a range of [RANGE1] to [RANGE2]',
    'zh-tw': '?????? [SENSOR] ??????????????? [RANGE1] ??? [RANGE2] ??????',
    'zh-cn': '?????? [SENSOR] ??????????????? [RANGE1] ??? [RANGE2] ??????',
    'pt-br': 'Converte valor: [SENSOR] para que fique entre [RANGE1] e [RANGE2]',
    'pt': 'Converte valor: [SENSOR] para que fique entre [RANGE1] e [RANGE2]',
    'fr': 'Convertir la valeur de [SENSOR] dans la plage [RANGE1] ?? [RANGE2]',
    'pl': 'Przelicz warto???? [SENSOR] do zakresu od [RANGE1] do [RANGE2]',
    'ja': '[SENSOR] ????????? [RANGE1] ?????? [RANGE2] ????????????????????????',
};

class Scratch3PicoboardOneGPIO {
    constructor(runtime) {
        the_locale = this._setLocale();
        this.runtime = runtime;
    }

    getInfo() {
        the_locale = this._setLocale();
        // connect to the websocket server
        this.connect();

        return {
            id: 'onegpioPicoboard',
            color1: '#0C5986',
            color2: '#34B0F7',
            name: 'OneGpio Picoboard',
            blockIconURI: 'data:image/png;base64,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',
            blocks: [
                {
                    opcode: 'sensor_comparison',
                    blockType: BlockType.HAT,
                    text: FormComparison[the_locale],
                    arguments: {
                        SENSOR: {
                            type: ArgumentType.STRING,
                            defaultValue: MENU_NON_BUTTON_SENSORS[the_locale][0],
                            menu: 'non_button_sensors'
                        },
                        COMP: {
                            type: ArgumentType.STRING,
                            defaultValue: MENU_COMPARISONS[the_locale][0],
                            menu: 'comparisons'
                        },
                        VALUE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 50,
                        }
                    }
                },
                {
                    opcode: 'button_change',
                    blockType: BlockType.HAT,
                    text: FormButton[the_locale],
                    arguments: {
                        STATE: {
                            type: ArgumentType.STRING,
                            defaultValue: MENU_BUTTON_STATES[the_locale][0],
                            menu: 'button_states'
                        }
                    }
                },
                {
                    opcode: 'sensor_between',
                    blockType: BlockType.HAT,
                    text: FormBetween[the_locale],
                    arguments: {
                        SENSOR: {
                            type: ArgumentType.STRING,
                            defaultValue: MENU_NON_BUTTON_SENSORS[the_locale][0],
                            menu: 'non_button_sensors'
                        },
                        LOW: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 25,
                        },
                        HIGH: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 75,
                        }
                    }
                },
                {
                    opcode: 'is_button_pressed',
                    blockType: BlockType.BOOLEAN,
                    text: FormIsButtonPressed[the_locale],
                },
                {
                    opcode: 'is_sensor',
                    blockType: BlockType.BOOLEAN,
                    text: FormIsSensorComparison[the_locale],
                    arguments: {
                        SENSOR: {
                            type: ArgumentType.STRING,
                            defaultValue: MENU_NON_BUTTON_SENSORS[the_locale][0],
                            menu: 'non_button_sensors'
                        },
                        COMP: {
                            type: ArgumentType.STRING,
                            defaultValue: MENU_COMPARISONS[the_locale][0],
                            menu: 'comparisons'
                        },
                        VALUE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 50,
                        }
                    }
                },
                {
                    opcode: 'current_sensor_value',
                    blockType: BlockType.REPORTER,
                    text: FormCurrentSensorValue[the_locale],
                    arguments: {
                        SENSOR: {
                            type: ArgumentType.STRING,
                            defaultValue: MENU_ALL_SENSORS[the_locale][0],
                            menu: 'all_sensors'
                        }
                    }
                },
                {
                    opcode: 'range_convert',
                    blockType: BlockType.REPORTER,
                    text: FormRangeConverter[the_locale],
                    arguments: {
                        SENSOR: {
                            type: ArgumentType.STRING,
                            defaultValue: MENU_NON_BUTTON_SENSORS[the_locale][0],
                            menu: 'non_button_sensors'
                        },
                        RANGE1: {
                            type: ArgumentType.NUMBER,
                            defaultValue: -240,
                        },
                        RANGE2: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 240,
                        }
                    }
                },
            ],
            menus: {
                all_sensors: 'getAllSensorMenuItems',
                //non_button_sensors: MENU_NON_BUTTON_SENSORS[the_locale],
                non_button_sensors: 'getAllNonButtonMenuItems',
                //button_states: MENU_BUTTON_STATES[the_locale],
                button_states: 'get_button_states',

                //all_sensors: MENU_ALL_SENSORS[the_locale],

                comparisons: MENU_COMPARISONS[the_locale],
            }
        };
    }

    getAllSensorMenuItems() {
        return MENU_ALL_SENSORS[the_locale];
    }

    getAllNonButtonMenuItems() {
        return MENU_NON_BUTTON_SENSORS[the_locale];
    }

    get_button_states() {
        return MENU_BUTTON_STATES[the_locale];
    }

    mapAllSensors(device) {
        //["Slider", "Light", "Sound", "Button", "A", "B", "C", "D"]
        /*
        data value 0 = D  analog inverted logic
        data value 1 = C  analog inverted logic
        data value 2 = B  analog inverted logic
        data value 3 = Button  digital inverted logic
        data value 4 = A  analog inverted logic
        data value 5 = Light  analog inverted logic
        data value 6 = sound  analog
        data value 7 = slider analog
         */
        //let theAllSensorMap = {0: 7, 1: 5, 2: 6, 3: 3, 4: 4, 5: 2, 6: 1, 7:0 }
        return theAllSensorMap[device];
    }

    mapNonButtonSensors(device) {
        //["Slider", "Light", "Sound", "A", "B", "C", "D"]
        return theNonButtonSensorMap[device];

    }

    // The block handlers

    sensor_between(args) {
        if (!connected) {
            if (!connection_pending) {
                this.connect();
                connection_pending = true;
            }
        }

        if (!connected) {
            let callbackEntry = [this.sensor_between.bind(this), args];
            wait_open.push(callbackEntry);
        } else {
            let sensor_text = args['SENSOR'];
            // get its index in the list of menu items
            let item_index = this.getAllNonButtonMenuItems().indexOf(sensor_text);
            // using the item_index, lookup the index into the
            // last data values to retrieve current data value for the sensor
            let map_key = this.mapNonButtonSensors(item_index);
            // get current value of sensor
            let value = lastDataSample[map_key];
            let low = parseInt(args['LOW'], 10);
            let high = parseInt(args['HIGH'], 10);
            return value >= low && value <= high;
        }
    }

    sensor_comparison(args) {
        if (!connected) {
            if (!connection_pending) {
                this.connect();
                connection_pending = true;
            }
        }

        if (!connected) {
            let callbackEntry = [this.sensor_comparison.bind(this), args];
            wait_open.push(callbackEntry);
        } else {
            let sensor_text = args['SENSOR'];
            // get its index in the list of menu items
            let item_index = this.getAllNonButtonMenuItems().indexOf(sensor_text);
            // using the item_index, lookup the index into the
            // last data values to retrieve current data value for the sensor
            let map_key = this.mapNonButtonSensors(item_index);
            // get current value of sensor
            let value = lastDataSample[map_key];
            let comp_type = args['COMP'];
            let comp_value = parseInt(args['VALUE'], 10);
            if (comp_type === '<') {
                return value < comp_value;
            } else {
                return value > comp_value;
            }
        }

    }

    button_change(args) {
        if (!connected) {
            if (!connection_pending) {
                this.connect();
                connection_pending = true;
            }
        }

        if (!connected) {
            let callbackEntry = [this.button_change.bind(this), args];
            wait_open.push(callbackEntry);
        } else {

            let item_index = this.get_button_states().indexOf(args['STATE']);
            // testing for pressed
            if (item_index === 0) {
                return lastDataSample[3] === 1;
            } else {
                return lastDataSample[3] === 0;
            }
        }
    }

    is_button_pressed(args) {
        if (!connected) {
            if (!connection_pending) {
                this.connect();
                connection_pending = true;
            }
        }

        if (!connected) {
            let callbackEntry = [this.is_button_pressed.bind(this), args];
            wait_open.push(callbackEntry);
        } else {
            // get current button value
            return Boolean(Number(lastDataSample[3]));

        }

    }

    is_sensor(args) {
        if (!connected) {
            if (!connection_pending) {
                this.connect();
                connection_pending = true;
            }
        }

        if (!connected) {
            let callbackEntry = [this.is_sensor.bind(this), args];
            wait_open.push(callbackEntry);
        } else {
            let sensor_text = args['SENSOR'];
            // get its index in the list of menu items
            let item_index = this.getAllNonButtonMenuItems().indexOf(sensor_text);
            // using the item_index, lookup the index into the
            // last data values to retrieve current data value for the sensor
            let map_key = this.mapNonButtonSensors(item_index);
            // get current value of sensor
            let value = lastDataSample[map_key];
            let comp_type = args['COMP'];
            let comp_value = parseInt(args['VALUE'], 10);
            if (comp_type === '<') {
                return value < comp_value;
            } else {
                return value > comp_value;
            }
        }

    }

    current_sensor_value(args) {
        if (!connected) {
            if (!connection_pending) {
                this.connect();
                connection_pending = true;
            }
        }

        if (!connected) {
            let callbackEntry = [this.current_sensor_value.bind(this), args];
            wait_open.push(callbackEntry);
        } else {
            // get the text of the menu item
            let sensor_text = args['SENSOR'];
            // get its index in the list of menu items
            let item_index = this.getAllSensorMenuItems().indexOf(sensor_text);
            // using the item_index, lookup the index into the
            // last data values to retrieve current data value for the sensor
            let map_key = this.mapAllSensors(item_index);
            // retrieve the data from the last data sample
            return lastDataSample[map_key];
        }

    }

    range_convert(args) {
        if (!connected) {
            if (!connection_pending) {
                this.connect();
                connection_pending = true;
            }
        }

        if (!connected) {
            let callbackEntry = [this.range_convert.bind(this), args];
            wait_open.push(callbackEntry);
        } else {
            // get the text of the menu item
            let sensor_text = args['SENSOR'];
            // get its index in the list of menu items
            let item_index = this.getAllNonButtonMenuItems().indexOf(sensor_text);
            // using the item_index, lookup the index into the
            // last data values to retrieve current data value for the sensor
            let map_key = this.mapNonButtonSensors(item_index);
            // get current value of sensor
            let value = lastDataSample[map_key];

            let high = parseInt(args['RANGE2'], 10);
            let low = parseInt(args['RANGE1'], 10);
            return Math.round(((value) * ((high - low) / 100)) +
                low);
        }

    }

    // end of block handlers

    _setLocale() {
        let now_locale = '';
        switch (formatMessage.setup().locale) {
            case 'zh-tw':
                now_locale = 'zh-tw';
                break;
            case 'zh-cn':
                now_locale = 'zh-cn';
                break;
            case 'en':
                now_locale = 'en';
                break;
            case 'pt-br':
                now_locale = 'pt-br';
                break;
            case 'pt':
                now_locale = 'pt';
                break;
            case 'fr':
                now_locale = 'fr';
                break;
            case 'pl':
                now_locale = 'pl';
                break;
            case 'ja':
                now_locale = 'ja';
                break;
            default:
                now_locale = 'en';
                break;
        }
        return now_locale;
    }

    // helpers
    connect() {
        if (connected) {
            // ignore additional connection attempts
            return;
        } else {
            connect_attempt = true;
            window.socket = new WebSocket("ws://127.0.0.1:9004");
            msg = JSON.stringify({"id": "to_picoboard_gateway"});
        }


        // websocket event handlers
        window.socket.onopen = function () {
            // connection complete
            connected = true;
            connect_attempt = true;
            // the message is built above
            try {
                //ws.send(msg);
                window.socket.send(msg);

            } catch (err) {
                // ignore this exception
            }
            for (let index = 0; index < wait_open.length; index++) {
                let data = wait_open[index];
                data[0](data[1]);
            }
        };

        window.socket.onclose = function () {
            if (alerted === false) {
                alerted = true;
                alert(FormWSClosed[the_locale]);}
            connected = false;
        };

        // reporter messages from the board
        window.socket.onmessage = function (message) {
            // store the latest incoming data
            msg = JSON.parse(message.data);
            // let report_type = msg["report"];
            lastDataSample = msg['report'];
        };
    }
}

module
    .exports = Scratch3PicoboardOneGPIO;
