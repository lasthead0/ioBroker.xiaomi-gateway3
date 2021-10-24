const assert = require('assert');

class SQLite {
    #pageSize = 0;
    #pos = 0
    
    constructor(raw) {
        this.raw = raw;
        this.readHeader();
        this.tables = this.readPage(0);
    }

    read(length) {
        let pos = this.#pos += length;
        return new Uint8Array(this.raw.slice(pos - length, pos));
    }

    readInt(length) {
        const raw = this.read(length);
        const raw2 = [].concat(Array.from({length: 8 - length}, () => 0), Array.from(raw));

        return Number(Buffer.from(raw2).readBigUInt64BE(0));
    }
    
    readVarint() {
        let result = 0;

        while (true) {
            const i = this.readInt(1);
            
            result += i & 0x7f;
            if (i < 0x80)
                break;
            
            result <<= 7;
        }

        return result;
    }

    readHeader() {
        assert(Buffer.from(this.read(16)).toString('utf-8') === 'SQLite format 3\0', new Error('Wrong file signature'));
        this.#pageSize = this.readInt(2);
    }

    readPage(pageNum) {
        this.#pos = (pageNum == 0) ? 100 : this.#pageSize * pageNum;

        const pageType = Number(this.read(1)[0]).toString(16).padStart(2, '0').toLocaleUpperCase();

        if (pageType == '0D')
            return this.readLeafTable(pageNum);
        else if (pageType == '05')
            return this.readInteriorTable(pageNum);
        else
            assert(false, new Error('Unknown table type'));
    }

    readLeafTable(pageNum) {
        const firstBlock = this.readInt(2);
        const cellsNum = this.readInt(2);
        let cellsPos = this.readInt(2);
        const fmtdFreeBytes = this.readInt(1);

        cellsPos = Array.from({length: cellsNum}, () => this.readInt(2));

        const rows = cellsPos.map(cellPos => {
            this.#pos = (this.#pageSize * pageNum) + cellPos;

            let payloadLen = this.readVarint();
            let rowId = this.readVarint();

            let columnsType = [];

            let payloadPos = this.#pos;
            let headerSize = this.readVarint();

            while (this.#pos < payloadPos + headerSize)
                columnsType.push(this.readVarint());

            return columnsType.map(columnType => {
                if (columnType == 0) {
                    return rowId;
                } else if (columnType >= 1 && columnType <= 4) {
                    return this.readInt(columnType);
                } else if (columnType == 5) {
                    return this.readInt(6);
                } else if (columnType == 6) {
                    return this.readInt(8);
                } else if (columnType == 7) {
                    return this.read(8);
                } else if (columnType == 8) {
                    return 0;
                } else if (columnType == 9) {
                    return 1;
                } else if (columnType >= 12 && columnType % 2 == 0) {
                    const length = Math.floor((columnType - 12) / 2);
                    return this.read(length);
                } else {
                    const length = Math.floor((columnType - 13) / 2);
                    return Buffer.from(this.read(length)).toString('utf-8');
                }
            });
        });

        return rows;
    }

    readInteriorTable(pageNum) {
        const firstBlock = this.readInt(2);
        const cellsNum = this.readInt(2);
        let cellsPos = this.readInt(2);
        const fmtdFreeBytes = this.readInt(1);
        const lastPageNum = this.readInt(4);

        cellsPos = Array.from({length: cellsNum}, () => this.readInt(2));

        const rows = cellsPos.reduce((rows, pos) => {
            this.#pos = (this.#pageSize * pageNum) + pos;
            let childPageNum = this.readInt(4);
            let rowId = this.readVarint();

            return [].concat(rows, this.readPage(childPageNum - 1)); 
        }, []);

        return [].concat(rows, this.readPage(lastPageNum - 1));
    }

    readTable(tableName) {
        const page = (this.tables.filter(t => t[1] == tableName)[0])[3] - 1;
        return this.readPage(page);
    }
}

/* */
module.exports = {SQLite};