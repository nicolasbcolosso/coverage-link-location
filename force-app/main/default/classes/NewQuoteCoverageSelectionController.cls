/**
 * @description Controller for the newQuoteCoverageSelection LWC component
 * Handles coverage selection with location-based Property coverage support
 * for the new Quote creation flow from Opportunity
 * @date 2025
 */
public with sharing class NewQuoteCoverageSelectionController {
  private static final String PROPERTY_COVERAGE_NAME = 'Property';

  /**
   * @description Get initialization data for new Quote creation from Opportunity
   * @param opportunityId The Id of the Opportunity record
   * @param raterType The selected rater type (for Scale opportunities)
   * @return InitializationWrapper containing all necessary data
   */
  @AuraEnabled
  public static InitializationWrapper getInitializationData(
    Id opportunityId,
    String raterType
  ) {
    InitializationWrapper wrapper = new InitializationWrapper();

    try {
      // Get Opportunity details
      Opportunity opp = [
        SELECT
          Id,
          Name,
          AccountId,
          Account.Name,
          RecordType.Name,
          RecordType.DeveloperName,
          Rater_Type__c
        FROM Opportunity
        WHERE Id = :opportunityId
        LIMIT 1
      ];

      wrapper.opportunityId = opp.Id;
      wrapper.accountId = opp.AccountId;
      wrapper.accountName = opp.Account.Name;
      wrapper.recordTypeName = opp.RecordType.Name;
      wrapper.isScale =
        opp.RecordType.Name != null && opp.RecordType.Name.contains('Scale');
      wrapper.raterType = String.isNotBlank(raterType)
        ? raterType
        : opp.Rater_Type__c;

      // Check if location-based Property is enabled
      wrapper.isLocationBasedPropertyEnabled = FeatureSettingsController.isLocationBasedPropertyEnabled();

      // Get locations for the account
      wrapper.accountLocations = getAccountLocations(opp.AccountId);

      // Get all available coverages
      wrapper.availableCoverages = getAvailableCoverages(
        wrapper.recordTypeName,
        wrapper.raterType,
        wrapper.isScale
      );

      // Get field sets for coverages
      wrapper.coverageFieldSets = getCoverageFieldSets(
        wrapper.availableCoverages
      );
    } catch (Exception e) {
      wrapper.errorMessage = e.getMessage();
      wrapper.hasError = true;
    }

    return wrapper;
  }

  /**
   * @description Get locations related to the account
   * @param accountId The Account Id
   * @return List of LocationWrapper
   */
  @AuraEnabled
  public static List<LocationWrapper> getAccountLocations(Id accountId) {
    List<LocationWrapper> locations = new List<LocationWrapper>();

    if (accountId == null) {
      return locations;
    }

    for (Location__c loc : [
      SELECT Id, Name, Location_Description__c, Account__c
      FROM Location__c
      WHERE Account__c = :accountId
      ORDER BY Name ASC
    ]) {
      LocationWrapper lw = new LocationWrapper();
      lw.id = loc.Id;
      lw.name = loc.Name;
      lw.description = loc.Location_Description__c;
      lw.isSelected = false;
      locations.add(lw);
    }

    return locations;
  }

  /**
   * @description Get all available coverages based on record type and rater type
   */
  private static List<CoverageWrapper> getAvailableCoverages(
    String recordType,
    String raterType,
    Boolean isScale
  ) {
    List<CoverageWrapper> coverages = new List<CoverageWrapper>();

    List<Coverage__c> coverageRecords;

    if (isScale && String.isNotBlank(raterType)) {
      coverageRecords = [
        SELECT Id, Name, Field_Set_for_Quote__c
        FROM Coverage__c
        ORDER BY Name ASC
      ];
    } else {
      coverageRecords = [
        SELECT Id, Name, Field_Set_for_Quote__c
        FROM Coverage__c
        ORDER BY Name ASC
      ];
    }

    for (Coverage__c cov : coverageRecords) {
      CoverageWrapper cw = new CoverageWrapper();
      cw.id = cov.Id;
      cw.name = cov.Name;
      cw.fieldSetName = cov.Field_Set_for_Quote__c;
      cw.isSelected = false;
      cw.isProperty = cov.Name == PROPERTY_COVERAGE_NAME;
      coverages.add(cw);
    }

    return coverages;
  }

  /**
   * @description Get field set information for each coverage
   */
  private static List<FieldSetWrapper> getCoverageFieldSets(
    List<CoverageWrapper> coverages
  ) {
    List<FieldSetWrapper> fieldSets = new List<FieldSetWrapper>();
    Schema.SObjectType qclType = Schema.getGlobalDescribe()
      .get('Quote_Coverage_Link__c');
    Map<String, Schema.FieldSet> fieldSetMap = qclType.getDescribe()
      .fieldSets.getMap();

    for (CoverageWrapper cov : coverages) {
      if (
        cov.fieldSetName != null && fieldSetMap.containsKey(cov.fieldSetName)
      ) {
        FieldSetWrapper fsw = new FieldSetWrapper();
        fsw.fieldSetName = cov.fieldSetName;
        fsw.coverageName = cov.name;
        fsw.fields = new List<FieldWrapper>();

        for (
          Schema.FieldSetMember fsm : fieldSetMap.get(cov.fieldSetName)
            .getFields()
        ) {
          FieldWrapper fw = new FieldWrapper();
          fw.fieldApiName = fsm.getFieldPath();
          fw.fieldLabel = fsm.getLabel();
          fw.fieldType = String.valueOf(fsm.getType());
          fw.isRequired = fsm.getRequired() || fsm.getDBRequired();
          fsw.fields.add(fw);
        }

        fieldSets.add(fsw);
      }
    }

    return fieldSets;
  }

  /**
   * @description Save new Quote with coverages including location-based Property
   * @param saveRequest JSON string containing the save request data
   * @return ResultWrapper with success/error information and the new Quote Id
   */
  @AuraEnabled
  public static ResultWrapper saveNewQuoteWithCoverages(String saveRequest) {
    ResultWrapper result = new ResultWrapper();
    Savepoint sp = Database.setSavepoint();

    System.debug('String save request ==> ' + saveRequest);

    try {
      SaveRequestWrapper request = (SaveRequestWrapper) JSON.deserialize(
        saveRequest,
        SaveRequestWrapper.class
      );

      System.debug('deserialize save request ==> ' + saveRequest);

      // Get Opportunity to determine record type
      Opportunity opp = [
        SELECT Id, RecordTypeId, Carrier_Issuing_Company__c
        FROM Opportunity
        WHERE Id = :request.opportunityId
        LIMIT 1
      ];

      Id scaleRecordTypeId = Schema.SObjectType.Opportunity.getRecordTypeInfosByName()
        .get('Scale')
        .getRecordTypeId();

      // Create the Quote
      Quote__c newQuote = new Quote__c();
      newQuote.Opportunity__c = request.opportunityId;
      newQuote.Status__c = 'Open';
      newQuote.Is_New_Property__c = request.isNewPropertyEnabled;

      // Set Quote fields from request
      if (request.quoteFields != null) {
        for (String fieldName : request.quoteFields.keySet()) {
          newQuote.put(fieldName, request.quoteFields.get(fieldName));
        }
      }

      // Set record type based on Opportunity
      if (scaleRecordTypeId == opp.RecordTypeId) {
        newQuote.RecordTypeId = Schema.SObjectType.Quote__c.getRecordTypeInfosByName()
          .get('Scale-Open')
          .getRecordTypeId();
        newQuote.Carrier_Issuing_Company__c = opp.Carrier_Issuing_Company__c;
        newQuote.Rater_Type__c = request.raterType;
      } else {
        newQuote.RecordTypeId = Schema.SObjectType.Quote__c.getRecordTypeInfosByName()
          .get('Open')
          .getRecordTypeId();
      }

      insert newQuote;
      result.quoteId = newQuote.Id;

      // Create Quote Coverage Links
      List<Quote_Coverage_Link__c> linksToInsert = new List<Quote_Coverage_Link__c>();

      // Process coverage field data
      Map<String, Quote_Coverage_Link__c> coverageLinksMap = new Map<String, Quote_Coverage_Link__c>();

      for (CoverageFieldData fieldData : request.coverageFieldData) {
        String linkKey;

        if (
          fieldData.isProperty &&
          fieldData.locationId != null &&
          request.isNewPropertyEnabled
        ) {
          // Property coverage with location - create unique key per location
          linkKey = fieldData.coverageName + '_' + fieldData.locationId;
        } else {
          // Regular coverage or Property without location
          linkKey = fieldData.coverageName;
        }

        Quote_Coverage_Link__c link;

        if (coverageLinksMap.containsKey(linkKey)) {
          link = coverageLinksMap.get(linkKey);
        } else {
          link = new Quote_Coverage_Link__c();
          link.Quote__c = newQuote.Id;
          link.Name = fieldData.coverageName;

          // Set location for Property coverage if enabled
          if (
            fieldData.isProperty &&
            fieldData.locationId != null &&
            request.isNewPropertyEnabled
          ) {
            link.Location__c = fieldData.locationId;
          }

          coverageLinksMap.put(linkKey, link);
        }

        // Set field value
        if (
          String.isNotBlank(fieldData.fieldApiName) &&
          fieldData.fieldValue != null
        ) {
          Object convertedValue = convertFieldValue(
            fieldData.fieldValue,
            fieldData.fieldType
          );
          link.put(fieldData.fieldApiName, convertedValue);
        }
      }

      linksToInsert.addAll(coverageLinksMap.values());

      System.debug('links to insert ==> ' + linksToInsert);

      if (!linksToInsert.isEmpty()) {
        insert linksToInsert;
      }

      result.isSuccess = true;
      result.message = 'Quote created successfully';
    } catch (Exception e) {
      Database.rollback(sp);
      result.isSuccess = false;
      result.message = e.getMessage();

      // Extract custom validation message if present
      if (result.message.contains('FIELD_CUSTOM_VALIDATION_EXCEPTION')) {
        result.message = result.message.substringBetween(
          'FIELD_CUSTOM_VALIDATION_EXCEPTION, ',
          ': '
        );
      }
    }

    return result;
  }

  /**
   * @description Convert field value from string to appropriate type
   */
  private static Object convertFieldValue(String value, String fieldType) {
    if (value == null || value == '') {
      return null;
    }

    try {
      if (
        fieldType == 'CURRENCY' ||
        fieldType == 'PERCENT' ||
        fieldType == 'DOUBLE' ||
        fieldType == 'DECIMAL'
      ) {
        return Decimal.valueOf(value);
      } else if (fieldType == 'INTEGER') {
        return Integer.valueOf(value);
      } else if (fieldType == 'DATE') {
        return Date.valueOf(value);
      } else if (fieldType == 'DATETIME') {
        return Datetime.valueOf(value);
      } else if (fieldType == 'BOOLEAN') {
        return Boolean.valueOf(value);
      } else {
        return value;
      }
    } catch (Exception e) {
      return value;
    }
  }

  // ==================== WRAPPER CLASSES ====================

  /**
   * @description Main initialization wrapper
   */
  public class InitializationWrapper {
    @AuraEnabled
    public Id opportunityId { get; set; }
    @AuraEnabled
    public Id accountId { get; set; }
    @AuraEnabled
    public String accountName { get; set; }
    @AuraEnabled
    public String recordTypeName { get; set; }
    @AuraEnabled
    public String raterType { get; set; }
    @AuraEnabled
    public Boolean isScale { get; set; }
    @AuraEnabled
    public Boolean isLocationBasedPropertyEnabled { get; set; }
    @AuraEnabled
    public List<CoverageWrapper> availableCoverages { get; set; }
    @AuraEnabled
    public List<LocationWrapper> accountLocations { get; set; }
    @AuraEnabled
    public List<FieldSetWrapper> coverageFieldSets { get; set; }
    @AuraEnabled
    public Boolean hasError { get; set; }
    @AuraEnabled
    public String errorMessage { get; set; }

    public InitializationWrapper() {
      this.hasError = false;
      this.isScale = false;
      this.isLocationBasedPropertyEnabled = false;
      this.availableCoverages = new List<CoverageWrapper>();
      this.accountLocations = new List<LocationWrapper>();
      this.coverageFieldSets = new List<FieldSetWrapper>();
    }
  }

  /**
   * @description Wrapper for Coverage__c records
   */
  public class CoverageWrapper {
    @AuraEnabled
    public Id id { get; set; }
    @AuraEnabled
    public String name { get; set; }
    @AuraEnabled
    public String fieldSetName { get; set; }
    @AuraEnabled
    public Boolean isSelected { get; set; }
    @AuraEnabled
    public Boolean isProperty { get; set; }
  }

  /**
   * @description Wrapper for Location__c records
   */
  public class LocationWrapper {
    @AuraEnabled
    public Id id { get; set; }
    @AuraEnabled
    public String name { get; set; }
    @AuraEnabled
    public String description { get; set; }
    @AuraEnabled
    public Boolean isSelected { get; set; }
  }

  /**
   * @description Wrapper for field set information
   */
  public class FieldSetWrapper {
    @AuraEnabled
    public String fieldSetName { get; set; }
    @AuraEnabled
    public String coverageName { get; set; }
    @AuraEnabled
    public List<FieldWrapper> fields { get; set; }
  }

  /**
   * @description Wrapper for individual field information
   */
  public class FieldWrapper {
    @AuraEnabled
    public String fieldApiName { get; set; }
    @AuraEnabled
    public String fieldLabel { get; set; }
    @AuraEnabled
    public String fieldType { get; set; }
    @AuraEnabled
    public Boolean isRequired { get; set; }
  }

  /**
   * @description Wrapper for save request
   */
  public class SaveRequestWrapper {
    @AuraEnabled
    public String opportunityId { get; set; }
    @AuraEnabled
    public String raterType { get; set; }
    @AuraEnabled
    public Boolean isNewPropertyEnabled { get; set; }
    @AuraEnabled
    public Map<String, String> quoteFields { get; set; }
    @AuraEnabled
    public List<CoverageFieldData> coverageFieldData { get; set; }
  }

  /**
   * @description Wrapper for coverage field data
   */
  public class CoverageFieldData {
    @AuraEnabled
    public String coverageName { get; set; }
    @AuraEnabled
    public String fieldApiName { get; set; }
    @AuraEnabled
    public String fieldValue { get; set; }
    @AuraEnabled
    public String fieldType { get; set; }
    @AuraEnabled
    public Id locationId { get; set; }
    @AuraEnabled
    public Boolean isProperty { get; set; }
  }

  /**
   * @description Wrapper for operation results
   */
  public class ResultWrapper {
    @AuraEnabled
    public Boolean isSuccess { get; set; }
    @AuraEnabled
    public String message { get; set; }
    @AuraEnabled
    public Id quoteId { get; set; }

    public ResultWrapper() {
      this.isSuccess = false;
      this.message = '';
    }
  }
}
