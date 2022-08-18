import _ from 'lodash';

export class ExtensionStorage {
    defaultStorage = {
        urlData : {},
        extensionOptions : {}
    };

    async set (data) {
        if (! data) {
            return;
        }
        const currentStorage = await this.get();
        const newStorage = _.cloneDeep(_.merge({}, this.defaultStorage, currentStorage, data));
        await chrome.storage.sync.set(newStorage);
    }

    async get () {
        const result = await chrome.storage.sync.get();
        const storage = _.cloneDeep(_.merge({}, this.defaultStorage, result));
        return storage;
    }
}