// mongoshHelpers.js 
// 
// Created by Marie Atterbury
// 
// Please note: this resource is shared for use "AS IS" without any 
// warranties of any kind, including, but not limited to
// their installation, use, or performance. We do not warrant that the technology will
// meet your requirements, that the operation thereof will be
// uninterrupted or error-free, or that any errors will be corrected.
//
// Any use of these scripts and tools is at your own risk. There is no
// guarantee that they have been through thorough testing in a
// comparable environment and we are not responsible for any damage
// or data loss incurred with their use.
//
// You are responsible for reviewing and testing any scripts you run
// thoroughly before use in any non-testing environment.
//
// Usage: 
// > load('./mongoshHelpers.js')
// > <run helper function (see below)>





function dropAllDbs() {

// Drop all databases (except those listed in excludeList)
// 
// > dropallDbs();
    
    print("WARNING! this will drop all external databases. Enter any text below + enter to continue")
    permission = passwordPrompt();

    if (permission != null) {

        print("Dropping dbs ...");

        // List any dbs to exclude
        excludeList = ['config', 'admin', 'local'];
        print("Excluding: " + excludeList);

        db.getMongo().getDBNames().forEach(function (d) {
            if (excludeList.indexOf(d) == -1) {
                var database = db.getSiblingDB(d);
                try {
                    database.dropDatabase()
                    print("Database dropped: " + d);
                } catch (err) { 
                    print(err);
                    print("Skipping " + d);
                }
            };
        });
    }
}




getAllDbAndCollNames = function() {

// Print all database and collection names
//
// > getAllDbAndCollNames();

    db.getMongo().getDBNames().forEach(function (d) {
        print("Database: " + d);
        var cdb = db.getSiblingDB(d);
        printjson(cdb.getCollectionNames());
    });
};




getCappedCollections = function() {

// Prints "true" for every capped collection in every database 
// 
// > getCappedCollections();

    db.getMongo().getDBNames().forEach(function (d) {
        print("Database: " + d);
        var cdb = db.getSiblingDB(d);
        var collnames = cdb.getCollectionNames();
        cdb.getCollectionNames().forEach(function (c) {
            var isCapped = cdb[c].stats().capped;
            print( "- " + c + ": " + isCapped );
        })
    });
}




var duplicates = [];

getDuplicateDocuments = function(dbName, collName, dupeField) {

// Returns duplicate document _ids and total count.
//
// > getDuplicateDocuments(dbName, collName, dupeField)

	console.log("starting")
	var resultCursor = db.getSiblingDB(dbName)[collName].aggregate([
			{ $group: { 
				_id: { "dupe_value": "$" + dupeField}, 
				dups: { "$addToSet": "$_id" }, 
				count: { "$sum": 1 } 
			} },
			{ $match: { count: { "$gt": 1 }} },
			{ $limit: 5000 },
		],
		{
			allowDiskUse: true
		}
	)

	return resultCursor.toArray()
}



getChangeStreamCursors = function(filterConditions = {}) {

// Returns a list of change stream cursors that were opened or iterated recently (idle change stream cursors).
// Based on currentOp output: https://www.mongodb.com/docs/manual/reference/method/db.currentOp/
//
//
// Usage: 
// 
//   Create a change stream and confirm it is listening -- for example: 
//
//      > cursor = db.test.watch()
//      > db.test.insertOne({testdoc: 1})
//      > cursor.tryNext()
//
//   View the change stream cursor in currentOp:
//
//      > getChangeStreamCursors(<filterConditions>)
//
//         - filterConditions          : optional object containing currentOp filter, e.g. { ns: 'db_name.collection_name'}
//


	print("Getting currently opened change stream cursors ...");
	print("Note: change stream cursor may not be returned if it was not opened or iterated recently \
		consider running immediately after running a method like tryNext(). \
		See https://www.mongodb.com/docs/manual/reference/method/cursor.tryNext/#mongodb-method-cursor.tryNext");

	cursors = db.getSiblingDB('admin').aggregate([
		{ $currentOp: { allUsers: true, idleCursors: true }},
		{ $match: filterConditions }, 
		{ $addFields: { 
			pipelineFirst: { $first: "$cursor.originatingCommand.pipeline" } 
		} },
		{ $match: {
			"pipelineFirst.$changeStream": {$exists: true} 
		} }, 
		{ $project:  {
			pipelineFirst: 0
		} }
	])

	return cursors

}



function getIndexesForDbs(excludeList) {

// Returns indexes in all collections in databases 
//
// > getIndexesForDbs(excludeList)
//
//     - excludeList :   Array of database names to exclude from output

	print("Getting indexes for db ...");

	print("Excluding: " + excludeList);

	db.getMongo().getDBNames().forEach(function (d) {
		if (excludeList.indexOf(d) == -1) {
			var database = db.getSiblingDB(d);
			var collections = database.getCollectionNames();	
			collections.forEach(function (collectionName) {
				var coll = database.getCollection(collectionName);
				try {
					indexes = coll.getIndexes();
					print("Database: " + d + " -- " + collectionName + ": " + JSON.stringify(indexes));
				} catch (err) { 
					print(err);
					print("Skipping " + collectionName);
				}
			});
		};
	});
}




function getTotalIndexSizesForDbs() {

// Prints total index size per database
//
// > getTotalIndexSizesForDbs();

	print("Calculating index sizes and counts for databases ...");

	excludeList = ['config', 'admin', 'local'];
	print("Excluding: " + excludeList + " views");

	var totalIndexSize = 0;
	var totalIndexCount = 0;
	db.getMongo().getDBNames().forEach(function (d) {
		if (excludeList.indexOf(d) == -1) {
			databaseIndexSize = 0;
			databaseIndexCount = 0;
			var database = db.getSiblingDB(d);
			var collections = database.getCollectionNames();	
			collections.forEach(function (collectionName) {
				var coll = database.getCollection(collectionName);
				try {
					databaseIndexCount += coll.getIndexes().length; 
					databaseIndexSize += coll.totalIndexSize();
				} catch (err) { 
					print(err) 
					print("Skipping " + coll)
				}
			});
			totalIndexSize += databaseIndexSize;
			totalIndexCount += databaseIndexCount;
			print("Database: " + d + " -- " + databaseIndexSize + " bytes (" + (databaseIndexSize / 1024 ) / 1024 + "MB)" + " / " + databaseIndexCount + " indexes");
		};
	});
	print("Total: " + totalIndexSize + " bytes (" + (totalIndexSize / 1024 ) / 1024 + "MB)" + " / " + totalIndexCount + " indexes");
}




runLongDurationOp = function(dbName,collectionName, durTimeMS) {

// Starts an operation that runs for a particular duration.
// The operation will scan documents and use resources on the cluster.
//
// > runLongDurationOp(<dbName>, <collectionName>, <durTimeMS>);
//
//     - dbName          : database name
//     - collectionName  : collection name
//     - durTimeMS       : duration of the operation in milliseconds

    console.log('running op on ' + dbName + '.' + collectionName + ' for ' + durTimeMS + ' ms')

    output = db.getSiblingDB(dbName)[collectionName].find({
        $where:'function() {'+
           'var d = new Date((new Date()).getTime() + ' + durTimeMS + ');' +
           'while (d > (new Date())) { }; ' + 
           //'console.log(); ' + 
           'return true;}'
    })

    console.log(output)
    
}




summarizeQueries = function(dbName,collectionName) {

// Produces a query summary for 4.4+ log entries. 
// Groups by query shape, calculates execution stats per shape, and sorts by aggregate duration across all queries.  
// 
// Usage: 
//
//   Create a cluster -- for example: 
//
//      $ mlaunch --replicaset --port <port>
//
//   Load log file into database (4.4+ logs only) -- for example: 
//
//      $ mongoimport <logfile.log> --port <port> --db <database> --collection <collection>
//
//   Connect to the database, load this script, and run the function to profile queries:
//
//      $ mongosh --port <port> 
//      ...
//
//      > load('./mongoshHelpers.js')
//      > summarizeQueries(<dbName>, <collectionName>);
//
//        - dbName          : database name
//        - collectionName  : collection name
//
// Output: 
//     - _id.plan                     : query shape (index used) 
//     - _id.ns                       : namespace where the query was run
//     - logCount                     : total number of log entries for the query shape
//     - sumDurationMillis            : total duration (ms) across all logged entries 
//     - avgDurationMillis            : average duration (ms) per query
//     - storage_sumTimeReadingMicros : total time (microseconds) reading from disk across all logged entries
//     - storage_sumBytesRead         : total bytes read from disk across all logged entries

  print('Returning query stats...')

  var stats = db.getSiblingDB(dbName)[collectionName].aggregate(
    [
      {
        $match: { "msg": "Slow query" }
      },
      {
        $group: {
          _id: {
              plan: "$attr.planSummary",
              ns: "$attr.ns", 
          },
          logCount: { $sum: 1 },
          sumDurationMillis: { $sum: "$attr.durationMillis" },
          avgDurationMillis: { $avg: "$attr.durationMillis" }, 
          storage_sumTimeReadingMicros: { $sum: "$attr.storage.data.timeReadingMicros" },
          storage_sumBytesRead: { $sum: "$attr.storage.data.bytesRead" },
        }
      }, 
      {
        $sort: { sumDurationMillis: -1 } 
      }, 
    ], 
    {
      allowDiskUse:true
    }
  )

  return stats
}

