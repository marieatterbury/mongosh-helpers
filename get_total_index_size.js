function getIndexInfos() {
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

getIndexInfos();


