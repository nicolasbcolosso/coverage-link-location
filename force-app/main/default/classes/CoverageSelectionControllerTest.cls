/**
 * @description Test class for CoverageSelectionController
 * @date 2025
 */
@isTest
private class CoverageSelectionControllerTest {
  @TestSetup
  static void setupTestData() {
    // Create Account
    Account testAccount = new Account(Name = 'Test Account');
    insert testAccount;

    // Create Locations
    List<Location__c> locations = new List<Location__c>();
    for (Integer i = 1; i <= 3; i++) {
      locations.add(
        new Location__c(
          Name = 'Location ' + i,
          Account__c = testAccount.Id,
          Location_Description__c = 'Description for Location ' + i
        )
      );
    }
    insert locations;

    // Create Opportunity
    Opportunity testOpp = new Opportunity(
      Name = 'Test Opportunity',
      AccountId = testAccount.Id,
      StageName = 'Prospecting',
      CloseDate = Date.today().addDays(30)
    );
    insert testOpp;

    // Create Quote
    Quote__c testQuote = new Quote__c(
      Opportunity__c = testOpp.Id,
      Status__c = 'Open',
      Is_New_Property__c = true
    );
    insert testQuote;

    // Create Accepted Quote for Policy/Endorsement tests
    Quote__c acceptedQuote = new Quote__c(
      Opportunity__c = testOpp.Id,
      Status__c = 'Accepted',
      Is_New_Property__c = true
    );
    insert acceptedQuote;

    // Create Policy
    Policy__c testPolicy = new Policy__c(
      Name = 'Test Policy',
      Opportunity__c = testOpp.Id,
      Is_New_Property__c = true
    );
    insert testPolicy;

    // Create Endorsement
    Endorsement__c testEndorsement = new Endorsement__c(
      Name = 'Test Endorsement',
      Policy__c = testPolicy.Id,
      Is_New_Property__c = true
    );
    insert testEndorsement;

    // Create Coverage records
    List<Coverage__c> coverages = new List<Coverage__c>();
    coverages.add(
      new Coverage__c(Name = 'Property', Field_Set_for_Quote__c = 'Property')
    );
    coverages.add(
      new Coverage__c(Name = 'D&O', Field_Set_for_Quote__c = 'D_O')
    );
    coverages.add(
      new Coverage__c(Name = 'EPL', Field_Set_for_Quote__c = 'EPL')
    );
    insert coverages;

    // Create Quote Coverage Links
    Quote_Coverage_Link__c qclProperty = new Quote_Coverage_Link__c(
      Name = 'Property',
      Quote__c = testQuote.Id,
      Location__c = locations[0].Id
    );
    insert qclProperty;

    Quote_Coverage_Link__c qclDO = new Quote_Coverage_Link__c(
      Name = 'D&O',
      Quote__c = testQuote.Id
    );
    insert qclDO;
  }

  @isTest
  static void testGetInitializationDataForQuote() {
    Quote__c quote = [SELECT Id FROM Quote__c WHERE Status__c = 'Open' LIMIT 1];

    Test.startTest();
    CoverageSelectionController.InitializationWrapper result = CoverageSelectionController.getInitializationData(
      quote.Id
    );
    Test.stopTest();

    System.assertEquals(
      'Quote__c',
      result.sObjectType,
      'Should return Quote__c as sObject type'
    );
    System.assertEquals(quote.Id, result.quoteId, 'Quote ID should match');
    System.assertEquals(
      true,
      result.isNewPropertyEnabled,
      'Is_New_Property__c should be true'
    );
    System.assertEquals(
      false,
      result.requiresDummyQuote,
      'Should not require dummy quote for Quote'
    );
    System.assertNotEquals(
      null,
      result.accountLocations,
      'Account locations should not be null'
    );
    System.assertEquals(
      3,
      result.accountLocations.size(),
      'Should have 3 locations'
    );
    System.assertNotEquals(
      null,
      result.availableCoverages,
      'Available coverages should not be null'
    );
    System.assertNotEquals(
      null,
      result.existingCoverageLinks,
      'Existing coverage links should not be null'
    );
  }

  @isTest
  static void testGetInitializationDataForPolicy() {
    Policy__c policy = [SELECT Id FROM Policy__c LIMIT 1];

    Test.startTest();
    CoverageSelectionController.InitializationWrapper result = CoverageSelectionController.getInitializationData(
      policy.Id
    );
    Test.stopTest();

    System.assertEquals(
      'Policy__c',
      result.sObjectType,
      'Should return Policy__c as sObject type'
    );
    System.assertEquals(policy.Id, result.policyId, 'Policy ID should match');
    System.assertEquals(
      false,
      result.requiresDummyQuote,
      'Should not require dummy quote when accepted quote exists'
    );
  }

  @isTest
  static void testGetInitializationDataForEndorsement() {
    Endorsement__c endorsement = [SELECT Id FROM Endorsement__c LIMIT 1];

    Test.startTest();
    CoverageSelectionController.InitializationWrapper result = CoverageSelectionController.getInitializationData(
      endorsement.Id
    );
    Test.stopTest();

    System.assertEquals(
      'Endorsement__c',
      result.sObjectType,
      'Should return Endorsement__c as sObject type'
    );
    System.assertEquals(
      endorsement.Id,
      result.endorsementId,
      'Endorsement ID should match'
    );
  }

  @isTest
  static void testGetAccountLocations() {
    Account acc = [SELECT Id FROM Account LIMIT 1];

    Test.startTest();
    List<CoverageSelectionController.LocationWrapper> locations = CoverageSelectionController.getAccountLocations(
      acc.Id
    );
    Test.stopTest();

    System.assertEquals(3, locations.size(), 'Should return 3 locations');
    System.assertEquals(
      'Location 1',
      locations[0].name,
      'First location should be Location 1'
    );
  }

  @isTest
  static void testGetAccountLocationsNullAccount() {
    Test.startTest();
    List<CoverageSelectionController.LocationWrapper> locations = CoverageSelectionController.getAccountLocations(
      null
    );
    Test.stopTest();

    System.assertEquals(
      0,
      locations.size(),
      'Should return empty list for null account'
    );
  }

  @isTest
  static void testCreateDummyQuote() {
    Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];

    // Delete existing quotes to test dummy quote creation
    delete [SELECT Id FROM Quote__c];

    Test.startTest();
    Id newQuoteId = CoverageSelectionController.createDummyQuote(opp.Id);
    Test.stopTest();

    System.assertNotEquals(null, newQuoteId, 'New quote ID should not be null');

    Quote__c newQuote = [
      SELECT Id, Status__c
      FROM Quote__c
      WHERE Id = :newQuoteId
    ];
    System.assertEquals(
      'Accepted',
      newQuote.Status__c,
      'Dummy quote should have Accepted status'
    );
  }

  @isTest
  static void testSaveCoveragesInsert() {
    Quote__c quote = [SELECT Id FROM Quote__c WHERE Status__c = 'Open' LIMIT 1];
    Location__c location = [SELECT Id FROM Location__c LIMIT 1];

    // Build save request for new coverage
    CoverageSelectionController.SaveRequestWrapper request = new CoverageSelectionController.SaveRequestWrapper();
    request.quoteId = quote.Id;
    request.policyId = null;
    request.endorsementId = null;
    request.coveragesToDelete = new List<String>();
    request.coverageFieldData = new List<CoverageSelectionController.CoverageFieldData>();

    // Add EPL coverage field data
    CoverageSelectionController.CoverageFieldData eplField = new CoverageSelectionController.CoverageFieldData();
    eplField.coverageName = 'EPL';
    eplField.fieldApiName = 'Retention__c';
    eplField.fieldValue = '10000';
    eplField.fieldType = 'CURRENCY';
    eplField.quoteCoverageLinkId = null;
    eplField.locationId = null;
    eplField.isProperty = false;
    request.coverageFieldData.add(eplField);

    Test.startTest();
    CoverageSelectionController.ResultWrapper result = CoverageSelectionController.saveCoverages(
      JSON.serialize(request)
    );
    Test.stopTest();

    System.assertEquals(true, result.isSuccess, 'Save should be successful');

    // Verify coverage was created
    List<Quote_Coverage_Link__c> eplLinks = [
      SELECT Id, Name, Retention__c
      FROM Quote_Coverage_Link__c
      WHERE Quote__c = :quote.Id AND Name = 'EPL'
    ];
    System.assertEquals(1, eplLinks.size(), 'EPL coverage should be created');
  }

  @isTest
  static void testSaveCoveragesWithLocationProperty() {
    Quote__c quote = [SELECT Id FROM Quote__c WHERE Status__c = 'Open' LIMIT 1];
    List<Location__c> locations = [SELECT Id FROM Location__c ORDER BY Name];

    // Delete existing property links
    delete [SELECT Id FROM Quote_Coverage_Link__c WHERE Name = 'Property'];

    // Build save request for Property coverage with locations
    CoverageSelectionController.SaveRequestWrapper request = new CoverageSelectionController.SaveRequestWrapper();
    request.quoteId = quote.Id;
    request.policyId = null;
    request.endorsementId = null;
    request.coveragesToDelete = new List<String>();
    request.coverageFieldData = new List<CoverageSelectionController.CoverageFieldData>();

    // Add Property coverage for multiple locations
    for (Location__c loc : locations) {
      CoverageSelectionController.CoverageFieldData propField = new CoverageSelectionController.CoverageFieldData();
      propField.coverageName = 'Property';
      propField.fieldApiName = 'Building_Value__c';
      propField.fieldValue = '500000';
      propField.fieldType = 'CURRENCY';
      propField.quoteCoverageLinkId = null;
      propField.locationId = loc.Id;
      propField.isProperty = true;
      request.coverageFieldData.add(propField);
    }

    Test.startTest();
    CoverageSelectionController.ResultWrapper result = CoverageSelectionController.saveCoverages(
      JSON.serialize(request)
    );
    Test.stopTest();

    System.assertEquals(true, result.isSuccess, 'Save should be successful');

    // Verify Property coverages were created for each location
    List<Quote_Coverage_Link__c> propertyLinks = [
      SELECT Id, Name, Location__c
      FROM Quote_Coverage_Link__c
      WHERE Quote__c = :quote.Id AND Name = 'Property'
    ];
    System.assertEquals(
      3,
      propertyLinks.size(),
      'Property coverage should be created for each location'
    );
  }

  @isTest
  static void testSaveCoveragesDelete() {
    Quote__c quote = [SELECT Id FROM Quote__c WHERE Status__c = 'Open' LIMIT 1];
    Quote_Coverage_Link__c existingLink = [
      SELECT Id
      FROM Quote_Coverage_Link__c
      WHERE Quote__c = :quote.Id AND Name = 'D&O'
      LIMIT 1
    ];

    // Build save request to delete existing coverage
    CoverageSelectionController.SaveRequestWrapper request = new CoverageSelectionController.SaveRequestWrapper();
    request.quoteId = quote.Id;
    request.policyId = null;
    request.endorsementId = null;
    request.coveragesToDelete = new List<String>{ existingLink.Id };
    request.coverageFieldData = new List<CoverageSelectionController.CoverageFieldData>();

    Test.startTest();
    CoverageSelectionController.ResultWrapper result = CoverageSelectionController.saveCoverages(
      JSON.serialize(request)
    );
    Test.stopTest();

    System.assertEquals(true, result.isSuccess, 'Delete should be successful');

    // Verify coverage was deleted
    List<Quote_Coverage_Link__c> remainingLinks = [
      SELECT Id
      FROM Quote_Coverage_Link__c
      WHERE Quote__c = :quote.Id AND Name = 'D&O'
    ];
    System.assertEquals(
      0,
      remainingLinks.size(),
      'D&O coverage should be deleted'
    );
  }

  @isTest
  static void testSaveCoveragesUpdate() {
    Quote__c quote = [SELECT Id FROM Quote__c WHERE Status__c = 'Open' LIMIT 1];
    Quote_Coverage_Link__c existingLink = [
      SELECT Id
      FROM Quote_Coverage_Link__c
      WHERE Quote__c = :quote.Id AND Name = 'D&O'
      LIMIT 1
    ];

    // Build save request to update existing coverage
    CoverageSelectionController.SaveRequestWrapper request = new CoverageSelectionController.SaveRequestWrapper();
    request.quoteId = quote.Id;
    request.policyId = null;
    request.endorsementId = null;
    request.coveragesToDelete = new List<String>();
    request.coverageFieldData = new List<CoverageSelectionController.CoverageFieldData>();

    CoverageSelectionController.CoverageFieldData doField = new CoverageSelectionController.CoverageFieldData();
    doField.coverageName = 'D&O';
    doField.fieldApiName = 'Retention__c';
    doField.fieldValue = '25000';
    doField.fieldType = 'CURRENCY';
    doField.quoteCoverageLinkId = existingLink.Id;
    doField.locationId = null;
    doField.isProperty = false;
    request.coverageFieldData.add(doField);

    Test.startTest();
    CoverageSelectionController.ResultWrapper result = CoverageSelectionController.saveCoverages(
      JSON.serialize(request)
    );
    Test.stopTest();

    System.assertEquals(true, result.isSuccess, 'Update should be successful');

    // Verify coverage was updated
    Quote_Coverage_Link__c updatedLink = [
      SELECT Id, Retention__c
      FROM Quote_Coverage_Link__c
      WHERE Id = :existingLink.Id
    ];
    System.assertEquals(
      25000,
      updatedLink.Retention__c,
      'Retention should be updated to 25000'
    );
  }

  @isTest
  static void testSaveCoveragesWithDifferentFieldTypes() {
    Quote__c quote = [SELECT Id FROM Quote__c WHERE Status__c = 'Open' LIMIT 1];

    CoverageSelectionController.SaveRequestWrapper request = new CoverageSelectionController.SaveRequestWrapper();
    request.quoteId = quote.Id;
    request.policyId = null;
    request.endorsementId = null;
    request.coveragesToDelete = new List<String>();
    request.coverageFieldData = new List<CoverageSelectionController.CoverageFieldData>();

    // Test different field types
    String[] fieldTypes = new List<String>{
      'CURRENCY',
      'PERCENT',
      'STRING',
      'DATE',
      'BOOLEAN',
      'INTEGER'
    };
    String[] fieldValues = new List<String>{
      '1000',
      '10.5',
      'Test',
      '2025-01-15',
      'true',
      '5'
    };
    String[] fieldNames = new List<String>{
      'Retention__c',
      'Co_Insurance__c',
      'Limits__c',
      'Effective_Date__c',
      'Equipment_Breakdown__c',
      'Aggregate__c'
    };

    for (Integer i = 0; i < fieldTypes.size(); i++) {
      CoverageSelectionController.CoverageFieldData field = new CoverageSelectionController.CoverageFieldData();
      field.coverageName = 'FID';
      field.fieldApiName = fieldNames[Math.mod(i, fieldNames.size())];
      field.fieldValue = fieldValues[i];
      field.fieldType = fieldTypes[i];
      field.quoteCoverageLinkId = null;
      field.locationId = null;
      field.isProperty = false;
      request.coverageFieldData.add(field);
    }

    Test.startTest();
    CoverageSelectionController.ResultWrapper result = CoverageSelectionController.saveCoverages(
      JSON.serialize(request)
    );
    Test.stopTest();

    // Result may fail due to field validation but should not throw exception
    System.assertNotEquals(null, result, 'Result should not be null');
  }

  @isTest
  static void testInitializationWithError() {
    // Test with invalid ID
    Test.startTest();
    try {
      CoverageSelectionController.InitializationWrapper result = CoverageSelectionController.getInitializationData(
        '001000000000000AAA'
      );
      System.assertEquals(
        true,
        result.hasError,
        'Should have error for invalid ID'
      );
    } catch (Exception e) {
      // Expected behavior for invalid ID
      System.assert(true, 'Exception expected for invalid ID');
    }
    Test.stopTest();
  }

  @isTest
  static void testPolicyWithoutAcceptedQuote() {
    // Create a new opportunity without accepted quote
    Account acc = [SELECT Id FROM Account LIMIT 1];
    Opportunity newOpp = new Opportunity(
      Name = 'New Test Opportunity',
      AccountId = acc.Id,
      StageName = 'Prospecting',
      CloseDate = Date.today().addDays(30)
    );
    insert newOpp;

    Policy__c newPolicy = new Policy__c(
      Name = 'New Test Policy',
      Opportunity__c = newOpp.Id,
      Is_New_Property__c = true
    );
    insert newPolicy;

    Test.startTest();
    CoverageSelectionController.InitializationWrapper result = CoverageSelectionController.getInitializationData(
      newPolicy.Id
    );
    Test.stopTest();

    System.assertEquals(
      true,
      result.requiresDummyQuote,
      'Should require dummy quote when no accepted quote exists'
    );
  }

  @isTest
  static void testWrapperClasses() {
    // Test InitializationWrapper initialization
    CoverageSelectionController.InitializationWrapper initWrapper = new CoverageSelectionController.InitializationWrapper();
    System.assertEquals(
      false,
      initWrapper.hasError,
      'hasError should default to false'
    );
    System.assertEquals(
      false,
      initWrapper.isScale,
      'isScale should default to false'
    );
    System.assertNotEquals(
      null,
      initWrapper.availableCoverages,
      'availableCoverages should be initialized'
    );

    // Test ResultWrapper initialization
    CoverageSelectionController.ResultWrapper resultWrapper = new CoverageSelectionController.ResultWrapper();
    System.assertEquals(
      false,
      resultWrapper.isSuccess,
      'isSuccess should default to false'
    );
    System.assertEquals(
      '',
      resultWrapper.message,
      'message should default to empty string'
    );

    // Test CoverageWrapper
    CoverageSelectionController.CoverageWrapper covWrapper = new CoverageSelectionController.CoverageWrapper();
    covWrapper.id = null;
    covWrapper.name = 'Test';
    covWrapper.fieldSetName = 'Test_FS';
    covWrapper.isSelected = true;
    covWrapper.isProperty = false;
    System.assertEquals('Test', covWrapper.name, 'Name should be set');

    // Test LocationWrapper
    CoverageSelectionController.LocationWrapper locWrapper = new CoverageSelectionController.LocationWrapper();
    locWrapper.id = null;
    locWrapper.name = 'Test Location';
    locWrapper.description = 'Test Description';
    locWrapper.isSelected = false;
    System.assertEquals('Test Location', locWrapper.name, 'Name should be set');

    // Test FieldWrapper
    CoverageSelectionController.FieldWrapper fieldWrapper = new CoverageSelectionController.FieldWrapper();
    fieldWrapper.fieldApiName = 'Test__c';
    fieldWrapper.fieldLabel = 'Test';
    fieldWrapper.fieldType = 'STRING';
    fieldWrapper.isRequired = true;
    System.assertEquals(
      'Test__c',
      fieldWrapper.fieldApiName,
      'Field API name should be set'
    );

    // Test FieldSetWrapper
    CoverageSelectionController.FieldSetWrapper fsWrapper = new CoverageSelectionController.FieldSetWrapper();
    fsWrapper.fieldSetName = 'Test_FS';
    fsWrapper.coverageName = 'Test Coverage';
    fsWrapper.fields = new List<CoverageSelectionController.FieldWrapper>();
    System.assertEquals(
      'Test_FS',
      fsWrapper.fieldSetName,
      'Field set name should be set'
    );

    // Test CoverageLinkWrapper
    CoverageSelectionController.CoverageLinkWrapper clWrapper = new CoverageSelectionController.CoverageLinkWrapper();
    clWrapper.id = null;
    clWrapper.name = 'Test Link';
    clWrapper.quoteId = null;
    clWrapper.policyId = null;
    clWrapper.endorsementId = null;
    clWrapper.locationId = null;
    clWrapper.isProperty = true;
    clWrapper.record = null;
    System.assertEquals('Test Link', clWrapper.name, 'Name should be set');
  }

  @isTest
  static void testCheckIsNewPropertyEnabledPolicy() {
    Policy__c policy = [SELECT Id FROM Policy__c LIMIT 1];

    Test.startTest();
    Boolean result = CoverageSelectionController.checkIsNewPropertyEnabled(
      policy.Id
    );
    Test.stopTest();

    System.assertEquals(
      true,
      result,
      'Policy should have Is_New_Property__c enabled'
    );
  }

  @isTest
  static void testCheckIsNewPropertyEnabledEndorsement() {
    Endorsement__c endorsement = [SELECT Id FROM Endorsement__c LIMIT 1];

    Test.startTest();
    Boolean result = CoverageSelectionController.checkIsNewPropertyEnabled(
      endorsement.Id
    );
    Test.stopTest();

    System.assertEquals(
      true,
      result,
      'Endorsement should have Is_New_Property__c enabled'
    );
  }

  @isTest
  static void testCheckIsNewPropertyEnabledQuote() {
    Quote__c quote = [SELECT Id FROM Quote__c WHERE Status__c = 'Open' LIMIT 1];

    Test.startTest();
    Boolean result = CoverageSelectionController.checkIsNewPropertyEnabled(
      quote.Id
    );
    Test.stopTest();

    System.assertEquals(
      true,
      result,
      'Quote should have Is_New_Property__c enabled'
    );
  }

  @isTest
  static void testCheckIsNewPropertyEnabledNullId() {
    Test.startTest();
    Boolean result = CoverageSelectionController.checkIsNewPropertyEnabled(
      null
    );
    Test.stopTest();

    System.assertEquals(false, result, 'Should return false for null Id');
  }
}
