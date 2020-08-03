const storage = require("azure-storage");
const config = require("../config");
const adapter = require("../dataAdapter");

const dataService = storage.createTableService(
  config.STORAGE_CONNECTION_STRING
);
const gen = storage.TableUtilities.entityGenerator;

let TABLE_NAME = "resources";

if (!!!process.env.PRODUCTION) {
  TABLE_NAME = `${TABLE_NAME}DEV`;
}

const getData = (query) => {
  return new Promise((resolve, reject) => {
    dataService.queryEntities(TABLE_NAME, query, null, (error, response) => {
      if (error) {
        reject(error);
      } else {
        adapter.init();
        let value = [];
        if (response.entries.length === 1) {
          const record = response.entries[0];
          value = adapter.adapt(record);
        } else {
          response.entries.forEach((entry) => {
            const record = adapter.adapt(entry);
            value.push(record);
          });
        }
        resolve({
          data: value,
          facets: adapter.facets(),
        });
      }
    });
  });
};

const _module = {
  get: (keyOrList, rowKey) => {
    const isCollectionQuery = !rowKey;
    if (isCollectionQuery) {
      return _module.getCollection(keyOrList);
    } else {
      return _module.getByKey(keyOrList, rowKey);
    }
  },

  getCollection: (selectList, where) => {
    return new Promise(async (resolve, reject) => {
      try {
        const query = new storage.TableQuery();

        if (selectList) {
          query.select(selectList.replace(/ /g, "").split(","));
        }

        if (where) {
          const matches = where.match(/([A-Za-z0-9]*) ?\= ?([A-Za-z0-9]*)/);
          if (matches && matches.length === 3) {
            const expression = `${matches[1]} eq ?`;
            query.where(expression, matches[2]);
          }
        }

        //.where("PartitionKey eq ?", partitionKey)

        const response = await getData(query);
        resolve(response);
      } catch (error) {
        reject(error);
      }
    });
  },

  getByKey: (partitionKey, rowKey) => {
    return new Promise(async (resolve, reject) => {
      try {
        const query = new storage.TableQuery()
          .top(1)
          .where("PartitionKey eq ?", partitionKey)
          .and("RowKey eq ?", rowKey);

        const result = await getData(query);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  },
  add: (resource) => {
    // TODO: need to support different types (Boolean, Ints), when necessary

    return new Promise((resolve, reject) => {
      const dto = {};
      for (let prop in resource) {
        dto[prop] = gen.String(resource[prop]);
      }

      dataService.insertEntity(TABLE_NAME, dto, (error, result, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  },
  remove: (partitionKey, rowKey) => {
    return new Promise((resolve, reject) => {
      const resource = {
        PartitionKey: { _: partitionKey },
        RowKey: { _: rowKey },
      };

      dataService.deleteEntity(TABLE_NAME, resource, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  },
};

module.exports = _module;