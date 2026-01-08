/**
 * @description Controller for the coverageSelection LWC component
 * Handles coverage selection with location-based Property coverage support
 * @date 2025
 */
public with sharing class CoverageSelectionController {
  private static final String PROPERTY_COVERAGE_NAME = 'Property';
  private static final String STATUS_ACCEPTED = 'Accepted';

  /**
   * @description Main initialization method - gets all data needed for the component
   * @param recordId The Id of the Quote__c, Policy__c, or Endorsement__c record
   * @return InitializationWrapper containing all necessary data
   */
  @AuraEnabled
  public static InitializationWrapper getInitializationData(Id recordId) {
    InitializationWrapper wrapper = new InitializationWrapper();

    try {
      // Determine sObject type
      String sObjectType = recordId.getSObjectType().getDescribe().getName();
      wrapper.sObjectType = sObjectType;

      System.debug('== sObject Type ==> ' + sObjectType);

      // Get record details and related data based on sObject type
      if (sObjectType == 'Quote__c') {
        wrapper = initializeForQuote(recordId, wrapper);
      } else if (sObjectType == 'Policy__c') {
        wrapper = initializeForPolicy(recordId, wrapper);
      } else if (sObjectType == 'Endorsement__c') {
        wrapper = initializeForEndorsement(recordId, wrapper);
      }

      // Get all available coverages
      wrapper.availableCoverages = getAvailableCoverages(
        wrapper.recordTypeName,
        wrapper.raterType,
        wrapper.isScale
      );

      // Get existing Quote Coverage Links
      wrapper.existingCoverageLinks = getExistingCoverageLinks(
        recordId,
        sObjectType,
        wrapper.quoteId
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
   * @description Initialize data for Quote__c record
   */
  private static InitializationWrapper initializeForQuote(
    Id recordId,
    InitializationWrapper wrapper
  ) {
    Quote__c quote = [
      SELECT
        Id,
        Name,
        Opportunity__c,
        Opportunity__r.AccountId,
        RecordType.Name,
        RecordType.DeveloperName,
        Rater_Type__c,
        Is_New_Property__c
      FROM Quote__c
      WHERE Id = :recordId
      LIMIT 1
    ];

    wrapper.quoteId = quote.Id;
    wrapper.opportunityId = quote.Opportunity__c;
    wrapper.accountId = quote.Opportunity__r.AccountId;
    wrapper.recordTypeName = quote.RecordType.Name;
    wrapper.isScale =
      quote.RecordType.Name != null && quote.RecordType.Name.contains('Scale');
    wrapper.raterType = quote.Rater_Type__c;
    wrapper.isNewPropertyEnabled = quote.Is_New_Property__c;
    wrapper.requiresDummyQuote = false;

    // Get locations for the account
    wrapper.accountLocations = getAccountLocations(wrapper.accountId);

    return wrapper;
  }

  /**
   * @description Initialize data for Policy__c record
   */
  private static InitializationWrapper initializeForPolicy(
    Id recordId,
    InitializationWrapper wrapper
  ) {
    Policy__c policy = [
      SELECT
        Id,
        Name,
        Opportunity__c,
        Opportunity__r.AccountId,
        RecordType.Name,
        RecordType.DeveloperName,
        Rater_Type__c,
        Is_New_Property__c
      FROM Policy__c
      WHERE Id = :recordId
      LIMIT 1
    ];

    wrapper.policyId = policy.Id;
    wrapper.opportunityId = policy.Opportunity__c;
    wrapper.accountId = policy.Opportunity__r.AccountId;
    wrapper.recordTypeName = policy.RecordType.Name;
    wrapper.isScale =
      policy.RecordType.Name != null &&
      policy.RecordType.Name.contains('Scale');
    wrapper.raterType = policy.Rater_Type__c;
    wrapper.isNewPropertyEnabled = policy.Is_New_Property__c;

    // Get accepted quote for policy
    try {
      Quote__c acceptedQuote = [
        SELECT Id
        FROM Quote__c
        WHERE
          Status__c = :STATUS_ACCEPTED
          AND Opportunity__c = :policy.Opportunity__c
        LIMIT 1
      ];
      wrapper.quoteId = acceptedQuote.Id;
      wrapper.requiresDummyQuote = false;
    } catch (QueryException e) {
      wrapper.quoteId = null;
      wrapper.requiresDummyQuote = true;
    }

    // Get locations for the account
    wrapper.accountLocations = getAccountLocations(wrapper.accountId);

    return wrapper;
  }

  /**
   * @description Initialize data for Endorsement__c record
   */
  private static InitializationWrapper initializeForEndorsement(
    Id recordId,
    InitializationWrapper wrapper
  ) {
    Endorsement__c endorsement = [
      SELECT
        Id,
        Name,
        Opportunity__c,
        Policy__r.Opportunity__r.AccountId,
        RecordType.Name,
        RecordType.DeveloperName,
        Policy__r.Rater_Type__c,
        Is_New_Property__c
      FROM Endorsement__c
      WHERE Id = :recordId
      LIMIT 1
    ];

    wrapper.endorsementId = endorsement.Id;
    wrapper.opportunityId = endorsement.Opportunity__c;
    wrapper.accountId = endorsement.Policy__r.Opportunity__r.AccountId;
    wrapper.recordTypeName = endorsement.RecordType.Name;
    wrapper.isScale =
      endorsement.RecordType.Name != null &&
      endorsement.RecordType.Name.contains('Scale');
    wrapper.raterType = endorsement.Policy__r.Rater_Type__c;
    wrapper.isNewPropertyEnabled = endorsement.Is_New_Property__c;

    // Get accepted quote for endorsement
    try {
      Quote__c acceptedQuote = [
        SELECT Id
        FROM Quote__c
        WHERE
          Status__c = :STATUS_ACCEPTED
          AND Opportunity__c = :endorsement.Opportunity__c
        LIMIT 1
      ];
      wrapper.quoteId = acceptedQuote.Id;
      wrapper.requiresDummyQuote = false;
    } catch (QueryException e) {
      wrapper.quoteId = null;
      wrapper.requiresDummyQuote = true;
    }

    // Get locations for the account
    wrapper.accountLocations = getAccountLocations(wrapper.accountId);

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

    Map<String, List<String>> scaleCoveragesByRaterType = new Map<String, List<String>>{
      'MATRIX' => new List<String>{ 'D&O', 'EPL', 'FID' },
      'EXCESS' => new List<String>{ 'Excess D&O', 'Excess EPL', 'Excess FID' },
      'EXOTICS' => new List<String>{ 'D&O', 'EPL', 'FID' },
      'TECH' => new List<String>{ 'E&O' },
      'FMP' => new List<String>{ 'D&O', 'EPL', 'FID' },
      'ML' => new List<String>{
        'CFI',
        'CYB',
        'D&O',
        'EPL',
        'FID',
        'E&O',
        'Excess D&O',
        'Excess EPL',
        'Excess FID',
        'Influencers Insurance',
        'FMP M&PL',
        'FMP EPL',
        'FMP FID',
        'Public D&O',
        'Lead Side A'
      }
    };

    if (raterType == null && !isScale) {
      List<String> accessibleFilter = new List<String>{
        'Foundershield',
        'For all Record Types'
      };
      if (recordType == 'Alpharoot') {
        accessibleFilter.add('AlphaRoot');
      }
      coverageRecords = [
        SELECT Id, Name, Field_Set_for_Quote__c
        FROM Coverage__c
        WHERE
          Field_Set_for_Quote__c != NULL
          AND (Accessible_Record_Types__c = NULL
          OR Accessible_Record_Types__c IN :accessibleFilter)
        ORDER BY Name ASC
      ];
    } else if (raterType == null && isScale) {
      coverageRecords = [
        SELECT Id, Name, Field_Set_for_Quote__c
        FROM Coverage__c
        WHERE
          Field_Set_for_Quote__c != NULL
          AND (Accessible_Record_Types__c = NULL
          OR Accessible_Record_Types__c = 'Scale'
          OR Accessible_Record_Types__c = 'For all Record Types')
        ORDER BY Name ASC
      ];
    } else {
      List<String> validCoverages = scaleCoveragesByRaterType.get(raterType);
      if (validCoverages == null) {
        validCoverages = new List<String>();
      }
      coverageRecords = [
        SELECT Id, Name, Field_Set_for_Quote__c
        FROM Coverage__c
        WHERE
          Name IN :validCoverages
          AND Field_Set_for_Quote__c != NULL
          AND (Accessible_Record_Types__c = NULL
          OR Accessible_Record_Types__c = 'Scale'
          OR Accessible_Record_Types__c = 'For all Record Types')
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
   * @description Get existing Quote Coverage Links for the record
   */
  private static List<CoverageLinkWrapper> getExistingCoverageLinks(
    Id recordId,
    String sObjectType,
    Id quoteId
  ) {
    List<CoverageLinkWrapper> links = new List<CoverageLinkWrapper>();

    Set<String> coverageLinkFields = Schema.getGlobalDescribe()
      .get('Quote_Coverage_Link__c')
      .getDescribe()
      .fields.getMap()
      .keySet();
    String fieldList = String.join(new List<String>(coverageLinkFields), ', ');

    String query =
      'SELECT ' +
      fieldList +
      ' FROM Quote_Coverage_Link__c WHERE ';

    if (sObjectType == 'Quote__c') {
      query += 'Quote__c = :recordId';
    } else if (sObjectType == 'Policy__c') {
      query += '(Policy__c = :recordId OR (Quote__c = :quoteId AND Quote__r.Status__c = :STATUS_ACCEPTED))';
    } else if (sObjectType == 'Endorsement__c') {
      query += 'Endorsement__c = :recordId';
    }

    query +=
      ' AND (Name != :PROPERTY_COVERAGE_NAME OR Location__c != null) ORDER BY Name ASC';

    for (Quote_Coverage_Link__c qcl : Database.query(query)) {
      CoverageLinkWrapper clw = new CoverageLinkWrapper();
      clw.id = qcl.Id;
      clw.name = qcl.Name;
      clw.quoteId = qcl.Quote__c;
      clw.policyId = qcl.Policy__c;
      clw.endorsementId = qcl.Endorsement__c;
      clw.locationId = qcl.Location__c;
      clw.isProperty = qcl.Name == PROPERTY_COVERAGE_NAME;
      clw.record = qcl;
      links.add(clw);
    }

    return links;
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
   * @description Create a dummy quote for Policy/Endorsement if none exists
   * @param opportunityId The Opportunity Id to create the quote for
   * @return The Id of the created Quote
   */
  @AuraEnabled
  public static Id createDummyQuote(Id opportunityId) {
    Opportunity opp = [
      SELECT Id, RecordTypeId, Carrier_Issuing_Company__c
      FROM Opportunity
      WHERE Id = :opportunityId
      LIMIT 1
    ];

    Id scaleRecordTypeId = Schema.SObjectType.Opportunity.getRecordTypeInfosByName()
      .get('Scale')
      .getRecordTypeId();

    Quote__c newQuote = new Quote__c();
    newQuote.Opportunity__c = opportunityId;
    newQuote.Status__c = 'Accepted';

    if (scaleRecordTypeId == opp.RecordTypeId) {
      newQuote.RecordTypeId = Schema.SObjectType.Quote__c.getRecordTypeInfosByName()
        .get('Scale-Open')
        .getRecordTypeId();
      newQuote.Carrier_Issuing_Company__c = opp.Carrier_Issuing_Company__c;
    } else {
      newQuote.RecordTypeId = Schema.SObjectType.Quote__c.getRecordTypeInfosByName()
        .get('Open')
        .getRecordTypeId();
    }

    insert newQuote;
    return newQuote.Id;
  }

  /**
   * @description Save coverages - handles both regular and location-based Property coverage
   * @param saveRequest JSON string containing the save request data
   * @return ResultWrapper with success/error information
   */
  @AuraEnabled
  public static ResultWrapper saveCoverages(String saveRequest) {
    ResultWrapper result = new ResultWrapper();
    Savepoint sp = Database.setSavepoint();

    try {
      SaveRequestWrapper request = (SaveRequestWrapper) JSON.deserialize(
        saveRequest,
        SaveRequestWrapper.class
      );

      System.debug('== req wrapper ==> ' + request);

      // Delete coverages marked for deletion
      if (
        request.coveragesToDelete != null &&
        !request.coveragesToDelete.isEmpty()
      ) {
        List<Quote_Coverage_Link__c> toDelete = new List<Quote_Coverage_Link__c>();
        for (String linkId : request.coveragesToDelete) {
          toDelete.add(new Quote_Coverage_Link__c(Id = linkId));
        }
        if (Schema.sObjectType.Quote_Coverage_Link__c.isDeletable()) {
          delete toDelete;
        }
      }

      // Process coverages to upsert
      Map<String, Quote_Coverage_Link__c> coveragesToUpsert = new Map<String, Quote_Coverage_Link__c>();

      for (CoverageFieldData cfd : request.coverageFieldData) {
        String key = cfd.coverageName;

        // For Property with location, use a composite key
        if (cfd.isProperty && cfd.locationId != null) {
          key = cfd.coverageName + '_' + cfd.locationId;
        }

        if (!coveragesToUpsert.containsKey(key)) {
          Quote_Coverage_Link__c qcl = new Quote_Coverage_Link__c(
            Name = cfd.coverageName,
            Quote__c = request.quoteId,
            Policy__c = request.policyId,
            Endorsement__c = request.endorsementId
          );

          if (cfd.quoteCoverageLinkId != null) {
            qcl.Id = cfd.quoteCoverageLinkId;
          }

          System.debug('== empty qcl ==> ' + qcl);

          // Set location for Property coverage
          if (cfd.isProperty && cfd.locationId != null) {
            qcl.Location__c = cfd.locationId;
          }

          System.debug('== filled qcl ==> ' + qcl);

          coveragesToUpsert.put(key, qcl);
        }

        // Set field value
        Quote_Coverage_Link__c qcl = coveragesToUpsert.get(key);
        Object convertedValue = convertFieldValue(
          cfd.fieldValue,
          cfd.fieldType
        );
        if (convertedValue != null) {
          qcl.put(cfd.fieldApiName, convertedValue);
        }
      }

      System.debug('== coverage to upsert ==> ' + coveragesToUpsert.values());

      if (!coveragesToUpsert.isEmpty()) {
        upsert coveragesToUpsert.values();
      }

      result.isSuccess = true;
      result.message = 'Coverages saved successfully.';
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

  /**
   * @description Checks if the Is_New_Property__c flag is enabled on the record
   * This is a lightweight method used by the router component to determine
   * which coverage selection component to render.
   * @param recordId The Id of the Policy__c or Endorsement__c record
   * @return Boolean indicating if Is_New_Property__c is true
   */
  @AuraEnabled(cacheable=true)
  public static Boolean checkIsNewPropertyEnabled(Id recordId) {
    if (recordId == null) {
      return false;
    }

    try {
      String sObjectType = recordId.getSObjectType().getDescribe().getName();
      Boolean isNewPropertyEnabled = false;

      if (sObjectType == 'Policy__c') {
        Policy__c policy = [
          SELECT Is_New_Property__c
          FROM Policy__c
          WHERE Id = :recordId
          LIMIT 1
        ];
        isNewPropertyEnabled = policy.Is_New_Property__c;
      } else if (sObjectType == 'Endorsement__c') {
        Endorsement__c endorsement = [
          SELECT Is_New_Property__c
          FROM Endorsement__c
          WHERE Id = :recordId
          LIMIT 1
        ];
        isNewPropertyEnabled = endorsement.Is_New_Property__c;
      } else if (sObjectType == 'Quote__c') {
        Quote__c quote = [
          SELECT Is_New_Property__c
          FROM Quote__c
          WHERE Id = :recordId
          LIMIT 1
        ];
        isNewPropertyEnabled = quote.Is_New_Property__c;
      }

      return isNewPropertyEnabled == true;
    } catch (Exception e) {
      System.debug('Error checking Is_New_Property__c: ' + e.getMessage());
      return false;
    }
  }

  // ==================== WRAPPER CLASSES ====================

  /**
   * @description Main initialization wrapper containing all data for component
   */
  public class InitializationWrapper {
    @AuraEnabled
    public String sObjectType { get; set; }
    @AuraEnabled
    public Id quoteId { get; set; }
    @AuraEnabled
    public Id policyId { get; set; }
    @AuraEnabled
    public Id endorsementId { get; set; }
    @AuraEnabled
    public Id opportunityId { get; set; }
    @AuraEnabled
    public Id accountId { get; set; }
    @AuraEnabled
    public String recordTypeName { get; set; }
    @AuraEnabled
    public String raterType { get; set; }
    @AuraEnabled
    public Boolean isScale { get; set; }
    @AuraEnabled
    public Boolean isNewPropertyEnabled { get; set; }
    @AuraEnabled
    public Boolean requiresDummyQuote { get; set; }
    @AuraEnabled
    public List<CoverageWrapper> availableCoverages { get; set; }
    @AuraEnabled
    public List<CoverageLinkWrapper> existingCoverageLinks { get; set; }
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
      this.isNewPropertyEnabled = false;
      this.requiresDummyQuote = false;
      this.availableCoverages = new List<CoverageWrapper>();
      this.existingCoverageLinks = new List<CoverageLinkWrapper>();
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
   * @description Wrapper for Quote_Coverage_Link__c records
   */
  public class CoverageLinkWrapper {
    @AuraEnabled
    public Id id { get; set; }
    @AuraEnabled
    public String name { get; set; }
    @AuraEnabled
    public Id quoteId { get; set; }
    @AuraEnabled
    public Id policyId { get; set; }
    @AuraEnabled
    public Id endorsementId { get; set; }
    @AuraEnabled
    public Id locationId { get; set; }
    @AuraEnabled
    public Boolean isProperty { get; set; }
    @AuraEnabled
    public Quote_Coverage_Link__c record { get; set; }
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
    public Id quoteId { get; set; }
    public Id policyId { get; set; }
    public Id endorsementId { get; set; }
    public List<String> coveragesToDelete { get; set; }
    public List<CoverageFieldData> coverageFieldData { get; set; }
  }

  /**
   * @description Wrapper for individual coverage field data
   */
  public class CoverageFieldData {
    public String coverageName { get; set; }
    public String fieldApiName { get; set; }
    public String fieldValue { get; set; }
    public String fieldType { get; set; }
    public Id quoteCoverageLinkId { get; set; }
    public Id locationId { get; set; }
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

    public ResultWrapper() {
      this.isSuccess = false;
      this.message = '';
    }
  }
}
