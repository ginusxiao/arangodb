/*jshint globalstrict:false, strict:false, maxlen: 500 */
/*global assertUndefined, assertEqual, assertTrue, assertFalse, AQL_EXECUTE */

////////////////////////////////////////////////////////////////////////////////
/// @brief tests for iresearch usage
///
/// @file
///
/// DISCLAIMER
///
/// Copyright 2010-2012 triagens GmbH, Cologne, Germany
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///
/// Copyright holder is triAGENS GmbH, Cologne, Germany
///
/// @author Jan Steemann
/// @author Copyright 2012, triAGENS GmbH, Cologne, Germany
////////////////////////////////////////////////////////////////////////////////

var jsunity = require("jsunity");
var db = require("@arangodb").db;

////////////////////////////////////////////////////////////////////////////////
/// @brief test suite
////////////////////////////////////////////////////////////////////////////////

function IResearchAqlTestSuite(numberOfShards, replicationFactor) {
  var c;
  var v;

  // provided arguments
  var args = {
    numberOfShards: numberOfShards, 
    replicationFactor: replicationFactor 
  };
  console.info("Test suite arguments: " + JSON.stringify(args));

  return {
    setUp : function () {
      db._drop("UnitTestsCollection");
      c = db._create("UnitTestsCollection", args);

      db._drop("AnotherUnitTestsCollection");
      var ac = db._create("AnotherUnitTestsCollection", args);

      db._dropView("UnitTestsView");
      v = db._createView("UnitTestsView", "arangosearch", {});
      var meta = { 
        links: { 
          "UnitTestsCollection": { 
            includeAllFields: true,
            fields: {
              text: { analyzers: [ "text_en" ] }
            }
          }
        }
      };
      v.properties(meta);

      ac.save({ a: "foo", id : 0 });
      ac.save({ a: "ba", id : 1 });

      for (let i = 0; i < 5; i++) {
        c.save({ a: "foo", b: "bar", c: i });
        c.save({ a: "foo", b: "baz", c: i });
        c.save({ a: "bar", b: "foo", c: i });
        c.save({ a: "baz", b: "foo", c: i });
      }

      c.save({ name: "full", text: "the quick brown fox jumps over the lazy dog" });
      c.save({ name: "half", text: "quick fox over lazy" });
      c.save({ name: "other half", text: "the brown jumps the dog" });
      c.save({ name: "quarter", text: "quick over" });

      c.save({ name: "numeric", anotherNumericField: 0 });
      c.save({ name: "null", anotherNullField: null });
      c.save({ name: "bool", anotherBoolField: true });
      c.save({ _key: "foo", xyz: 1 });
    },

    tearDown : function () {
      var meta = { links : { "UnitTestsCollection": null } };
      v.properties(meta);
      v.drop();
      db._drop("UnitTestsCollection");
      db._drop("AnotherUnitTestsCollection");
    },

    testAttributeEqualityFilter : function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER doc.a == 'foo' RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, 10);
      result.forEach(function(res) {
        assertEqual(res.a, "foo");
      });
    },

    testMultipleAttributeEqualityFilter : function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER doc.a == 'foo' && doc.b == 'bar' RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, 5);
      result.forEach(function(res) {
        assertEqual(res.a, "foo");
        assertEqual(res.b, "bar");
      });
    },

    testMultipleAttributeEqualityFilterSortAttribute : function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER doc.a == 'foo' && doc.b == 'bar' SORT doc.c RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, 5);
      var last = -1;
      result.forEach(function(res) {
        assertEqual(res.a, "foo");
        assertEqual(res.b, "bar");
        assertEqual(res.c, last + 1);
        last = res.c;
      });
    },

    testMultipleAttributeEqualityFilterSortAttributeDesc : function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER doc.a == 'foo' AND doc.b == 'bar' SORT doc.c DESC RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, 5);
      var last = 5;
      result.forEach(function(res) {
        assertEqual(res.a, "foo");
        assertEqual(res.b, "bar");
        assertEqual(res.c, last - 1);
        last = res.c;
      });
    },

    testAttributeLessFilter : function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER doc.c < 2 RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, 8);
      result.forEach(function(res) {
        assertTrue(res.c < 2);
      });
    },

    testAttributeLeqFilter : function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER doc.c <= 2 RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, 12);
      result.forEach(function(res) {
        assertTrue(res.c <= 2);
      });
    },

    testAttributeGeqFilter : function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER doc.c >= 2 RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, 12);
      result.forEach(function(res) {
        assertTrue(res.c >= 2);
      });
    },

    testAttributeGreaterFilter : function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER doc.c > 2 RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, 8);
      result.forEach(function(res) {
        assertTrue(res.c > 2);
      });
    },

    testAttributeOpenIntervalFilter : function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER doc.c > 1 AND doc.c < 3 RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, 4);
      result.forEach(function(res) {
        assertTrue(res.c > 1 && res.c < 3);
      });
    },

    testAttributeClosedIntervalFilter : function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER doc.c >= 1 AND doc.c <= 3 RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, 12);
      result.forEach(function(res) {
        assertTrue(res.c >= 1 && res.c <= 3);
      });
    },

    testAttributeIntervalExclusionFilter : function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER doc.c < 1 OR doc.c > 3 RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, 8);
      result.forEach(function(res) {
        assertTrue(res.c < 1 || res.c > 3);
      });
    },

    testAttributeNeqFilter : function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER doc.a != 'foo'  RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, 18); // include documents without attribute 'a'
      result.forEach(function(res) {
        assertFalse(res.a === 'foo');
      });
    },

    testStartsWithFilter : function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER STARTS_WITH(doc.a, 'fo') RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, 10);
      result.forEach(function(res) {
        assertEqual(res.a, 'foo');
      });
    },

    testStartsWithFilter2 : function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER STARTS_WITH(doc.b, 'ba') RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, 10);
      result.forEach(function(res) {
        assertTrue(res.b === 'bar' || res.b === 'baz');
      });
    },

    testStartsWithFilterSort : function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER STARTS_WITH(doc.b, 'ba') && doc.c == 0 SORT doc.b RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, 2);
      assertEqual(result[0].b, 'bar');
      assertEqual(result[1].b, 'baz');
      assertEqual(result[0].c, 0);
      assertEqual(result[1].c, 0);
    },

    testInTokensFilterSortTFIDF : function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER ANALYZER(doc.text IN TOKENS('the quick brown', 'text_en'), 'text_en') SORT TFIDF(doc) LIMIT 4 RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, 4);
      assertEqual(result[0].name, 'other half');
      assertEqual(result[1].name, 'full');
      assertEqual(result[2].name, 'half');
      assertEqual(result[3].name, 'quarter');
    },

    testPhraseFilter : function () {
      var result0 = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER PHRASE(doc.text, 'quick brown fox jumps', 'text_en') RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result0.length, 1);
      assertEqual(result0[0].name, 'full');

      var result1 = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER PHRASE(doc.text, [ 'quick brown fox jumps' ], 'text_en') RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result1.length, 1);
      assertEqual(result1[0].name, 'full');

      var result2 = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER ANALYZER(PHRASE(doc.text, 'quick brown fox jumps'), 'text_en') RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result2.length, 1);
      assertEqual(result2[0].name, 'full');

      var result3 = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER ANALYZER(PHRASE(doc.text, [ 'quick brown fox jumps' ]), 'text_en') RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result3.length, 1);
      assertEqual(result3[0].name, 'full');
    },

    testExistsFilter : function () {
      var expected = new Set();
      expected.add("full");
      expected.add("half");
      expected.add("other half");
      expected.add("quarter");

      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER EXISTS(doc.text) RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, expected.size);
      result.forEach(function(res) {
        assertTrue(expected.delete(res.name));
      });
      assertEqual(expected.size, 0);
    },

    testExistsFilterByAnalyzer: function () {
      var expected = new Set();
      expected.add("full");
      expected.add("half");
      expected.add("other half");
      expected.add("quarter");

      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER EXISTS(doc.text, 'analyzer', 'text_en') RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, expected.size);
      result.forEach(function(res) {
        assertTrue(expected.delete(res.name));
      });
      assertEqual(expected.size, 0);
    },

    testExistsFilterByIdentityAnalyzer: function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER EXISTS(doc.text, 'analyzer') RETURN doc", null, { waitForSync: true }).json;

      assertEqual(0, result.length);
    },

    testExistsFilterByContextAnalyzer: function () {
      var expected = new Set();
      expected.add("full");
      expected.add("half");
      expected.add("other half");
      expected.add("quarter");

      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER ANALYZER(EXISTS(doc.text, 'analyzer'), 'text_en') RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, expected.size);
      result.forEach(function(res) {
        assertTrue(expected.delete(res.name));
      });
      assertEqual(expected.size, 0);
    },

    testExistsFilterByString: function () {
      var expected = new Set();
      expected.add("full");
      expected.add("half");
      expected.add("other half");
      expected.add("quarter");

      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER EXISTS(doc.text, 'string') RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, expected.size);
      result.forEach(function(res) {
        assertTrue(expected.delete(res.name));
      });
      assertEqual(expected.size, 0);
    },

    testExistsFilterByType : function () {
      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER EXISTS(doc.text, 'type') RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, 0);
    },

    testExistsFilterByTypeNull : function () {
      var expected = new Set();
      expected.add("null");

      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER EXISTS(doc.anotherNullField, 'null') RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, expected.size);
      result.forEach(function(res) {
        assertTrue(expected.delete(res.name));
      });
      assertEqual(expected.size, 0);
    },

    testExistsFilterByTypeBool : function () {
      var expected = new Set();
      expected.add("bool");

      var result = AQL_EXECUTE("FOR doc IN VIEW UnitTestsView FILTER EXISTS(doc['anotherBoolField'], 'bool') RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, expected.size);
      result.forEach(function(res) {
        assertTrue(expected.delete(res.name));
      });
      assertEqual(expected.size, 0);
    },

    testExistsFilterByTypeNumeric : function () {
      var expected = new Set();
      expected.add("numeric");

      var result = AQL_EXECUTE("LET suffix='NumericField' LET fieldName = CONCAT('another', suffix) FOR doc IN VIEW UnitTestsView FILTER EXISTS(doc[fieldName], 'numeric') RETURN doc", null, { waitForSync: true }).json;

      assertEqual(result.length, expected.size);
      result.forEach(function(res) {
        assertTrue(expected.delete(res.name));
      });
      assertEqual(expected.size, 0);
    },

    testViewInInnerLoop : function() {
      var expected = new Set(); // FIXME is there a better way to compare objects in js?
      expected.add(JSON.stringify({ a: "foo", b: "bar", c: 0 }));
      expected.add(JSON.stringify({ a: "foo", b: "baz", c: 0 }));
      expected.add(JSON.stringify({ a: "bar", b: "foo", c: 1 }));
      expected.add(JSON.stringify({ a: "baz", b: "foo", c: 1 }));

      var result = AQL_EXECUTE(
        "FOR adoc IN AnotherUnitTestsCollection" +
        "  FOR doc IN VIEW UnitTestsView FILTER adoc.id == doc.c && STARTS_WITH(doc['a'], adoc.a) " +
        "RETURN doc"
      , null, { waitForSync: true }).json;


      assertEqual(result.length, expected.size);
      result.forEach(function(res) {
        assertTrue(expected.delete(JSON.stringify({ a: res.a, b: res.b, c: res.c })));
      });
      assertEqual(expected.size, 0);
    },

    testViewInInnerLoopMultipleFilters : function() {
      var expected = new Set(); // FIXME is there a better way to compare objects in js?
      expected.add(JSON.stringify({ a: "foo", b: "bar", c: 0 }));
      expected.add(JSON.stringify({ a: "foo", b: "baz", c: 0 }));

      var result = AQL_EXECUTE(
        "FOR adoc IN AnotherUnitTestsCollection FILTER adoc.id < 1" +
        "  FOR doc IN VIEW UnitTestsView FILTER adoc.id == doc.c && STARTS_WITH(doc['a'], adoc.a) " +
        "RETURN doc"
      , null, { waitForSync: true }).json;


      assertEqual(result.length, expected.size);
      result.forEach(function(res) {
        assertTrue(expected.delete(JSON.stringify({ a: res.a, b: res.b, c: res.c })));
      });
      assertEqual(expected.size, 0);
    },

    testViewInInnerLoopSortByAttribute : function() {
      var expected = [];
      expected.push({ a: "bar", b: "foo", c: 1 });
      expected.push({ a: "baz", b: "foo", c: 1 });
      expected.push({ a: "foo", b: "bar", c: 0 });
      expected.push({ a: "foo", b: "baz", c: 0 });

      var result = AQL_EXECUTE(
        "FOR adoc IN AnotherUnitTestsCollection" +
        "  FOR doc IN VIEW UnitTestsView FILTER adoc.id == doc.c && STARTS_WITH(doc['a'], adoc.a) " +
        "SORT doc.c DESC, doc.a, doc.b " +
        "RETURN doc"
      , null, { waitForSync: true }).json;

      assertEqual(result.length, expected.length);
      var i = 0;
      result.forEach(function(res) {
        var doc = expected[i++];
        assertEqual(doc.a, res.a);
        assertEqual(doc.b, res.b);
        assertEqual(doc.c, res.c);
      });
    },
/*
    testViewInInnerLoopSortByTFIDF_BM25_Attribute : function() {
      var expected = [];
      expected.push({ a: "baz", b: "foo", c: 1 });
      expected.push({ a: "bar", b: "foo", c: 1 });
      expected.push({ a: "foo", b: "bar", c: 0 });
      expected.push({ a: "foo", b: "baz", c: 0 });

      var result = AQL_EXECUTE(
        "FOR adoc IN AnotherUnitTestsCollection" +
        "  FOR doc IN VIEW UnitTestsView FILTER adoc.id == doc.c && STARTS_WITH(doc['a'], adoc.a) " +
        "SORT TFIDF(doc) DESC, BM25(doc) DESC, doc.a DESC, doc.b " +
        "RETURN doc"
      , null, { waitForSync: true }).json;

      assertEqual(result.length, expected.length);
      var i = 0;
      result.forEach(function(res) {
        var doc = expected[i++];
        assertEqual(doc.a, res.a);
        assertEqual(doc.b, res.b);
        assertEqual(doc.c, res.c);
      });
    },
*/
  };
}

////////////////////////////////////////////////////////////////////////////////
/// @brief executes the test suite
////////////////////////////////////////////////////////////////////////////////

jsunity.run(function IResearchAqlTestSuite_s1_r1() {
  return IResearchAqlTestSuite({ numberOfShards: 1, replicationFactor: 1 });
});

jsunity.run(function IResearchAqlTestSuite_s4_r1() {
  return IResearchAqlTestSuite({ numberOfShards: 4, replicationFactor: 1 });
});

/*

jsunity.run(function IResearchAqlTestSuite_s1_r2() {
  return IResearchAqlTestSuite({ numberOfShards: 1, replicationFactor: 2 })
});

jsunity.run(function IResearchAqlTestSuite_s4_r3() {
  return IResearchAqlTestSuite({ numberOfShards: 4, replicationFactor: 3 })
});

*/

return jsunity.done();
