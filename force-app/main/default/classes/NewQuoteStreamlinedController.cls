/**
 * @description Controller for the newQuoteStreamlined LWC component
 * Handles simplified Quote creation from Opportunity with automatic field population
 * and location-based field mapping for Property coverage.
 *
 * This controller provides a zero-configuration Quote creation flow where:
 * - Quote fields are auto-populated from the Opportunity
 * - Quote_Coverage_Link__c records are created with Location field mapping
 * - Users only select coverages without entering any field values
 *
 * Uses the same location field mappings as NewQuoteCoverageSelectionController
 * for consistency in field mapping behavior.
 *
 */
public without sharing class NewQuoteStreamlinedController {
  private static final String PROPERTY_COVERAGE_NAME = 'Property';

  /**
   * @description Get initialization data for the streamlined Quote creation UI
   * Fetches coverages, locations, and opportunity details needed for the simplified flow
   *
   * @param opportunityId The Id of the Opportunity record
   * @return StreamlinedInitWrapper containing coverages, locations, and metadata
   * @throws AuraHandledException if opportunityId is invalid or inaccessible
   */
  @AuraEnabled(cacheable=true)
  public static StreamlinedInitWrapper getInitializationData(
    String opportunityId
  ) {
    try {
      StreamlinedInitWrapper wrapper = new StreamlinedInitWrapper();

      // Fetch Opportunity details
      Opportunity opp = [
        SELECT
          Id,
          Name,
          AccountId,
          Account.Name,
          RecordType.Name,
          RecordType.DeveloperName,
          Rater_Type__c,
          Carrier_Issuing_Company__c,
          Marketer_UW_Name__c
        FROM Opportunity
        WHERE Id = :opportunityId
        // WITH SECURITY_ENFORCED
        LIMIT 1
      ];

      wrapper.opportunityId = opp.Id;
      wrapper.accountId = opp.AccountId;
      wrapper.accountName = opp.Account.Name;
      wrapper.recordTypeName = opp.RecordType.Name;
      wrapper.isScale =
        opp.RecordType.Name != null && opp.RecordType.Name.contains('Scale');
      wrapper.raterType = String.isNotBlank(opp.Rater_Type__c)
        ? opp.Rater_Type__c
        : null;

      // Fetch all available coverages
      wrapper.coverages = getCoveragesForInitialization();

      // Fetch Account Locations for location-based Property coverage
      wrapper.locations = getAccountLocationsWithFieldValues(opp.AccountId);

      // Determine if location-based property is enabled
      wrapper.isLocationBasedPropertyEnabled = isLocationBasedPropertyEnabled();

      return wrapper;
    } catch (QueryException e) {
      throw new AuraHandledException(
        'Failed to fetch initialization data: ' + e.getMessage()
      );
    } catch (Exception e) {
      throw new AuraHandledException('Unexpected error: ' + e.getMessage());
    }
  }

  /**
   * @description Create a new Quote record with associated Quote_Coverage_Link__c records
   * Implements the streamlined flow where all data is auto-populated based on selections
   *
   * @param opportunityId The Opportunity record Id
   * @param selectedCoveragesJson JSON string containing selected coverages and locations
   * @return CreateQuoteResult with quote Id and status
   * @throws AuraHandledException if data is invalid or creation fails
   */
  @AuraEnabled
  public static CreateQuoteResult createQuoteStreamlined(
    String opportunityId,
    String selectedCoveragesJson
  ) {
    CreateQuoteResult result = new CreateQuoteResult();

    try {
      // Validate input
      if (
        String.isBlank(opportunityId) || String.isBlank(selectedCoveragesJson)
      ) {
        throw new AuraHandledException('Invalid input parameters');
      }

      // Parse the JSON input
      SelectedCoveragesWrapper selectedCoverages = (SelectedCoveragesWrapper) JSON.deserialize(
        selectedCoveragesJson,
        SelectedCoveragesWrapper.class
      );

      // Validate at least one coverage is selected
      if (
        selectedCoverages.coverages == null ||
        selectedCoverages.coverages.isEmpty()
      ) {
        throw new AuraHandledException('Please select at least one coverage');
      }

      // Fetch Opportunity
      Opportunity opp = [
        SELECT
          Id,
          AccountId,
          Carrier_Issuing_Company__c,
          Marketer_UW_Name__c,
          RecordTypeId
        FROM Opportunity
        WHERE Id = :opportunityId
        // WITH SECURITY_ENFORCED
        LIMIT 1
      ];

      // Fetch Coverage records with field set metadata
      Map<String, Coverage__c> coverageMap = getCoverageMap(selectedCoverages);

      // Fetch Location records if Property coverage is selected
      Map<String, Location__c> locationMap = new Map<String, Location__c>();
      if (isPropertySelected(selectedCoverages)) {
        locationMap = getLocationMapByIds(
          getLocationIdsFromSelection(selectedCoverages)
        );
      }

      // Create the Quote record
      Quote__c newQuote = buildQuoteRecord(opp, selectedCoverages, coverageMap);
      insert newQuote;

      // Create Quote_Coverage_Link__c records
      List<Quote_Coverage_Link__c> coverageLinks = buildQuoteCoverageLinks(
        newQuote.Id,
        selectedCoverages,
        coverageMap,
        locationMap
      );

      if (!coverageLinks.isEmpty()) {
        insert coverageLinks;
      }

      // Build success response
      result.isSuccess = true;
      result.quoteId = newQuote.Id;
      result.message =
        'Quote created successfully with ' +
        coverageLinks.size() +
        ' coverage(s)';

      return result;
    } catch (DmlException e) {
      result.isSuccess = false;
      result.message = 'Database error: ' + e.getMessage();
      result.errors = new List<String>{ e.getDmlMessage(0) };
      return result;
    } catch (JSONException e) {
      result.isSuccess = false;
      result.message = 'Invalid JSON data: ' + e.getMessage();
      result.errors = new List<String>{ e.getMessage() };
      return result;
    } catch (Exception e) {
      result.isSuccess = false;
      result.message = 'Error creating quote: ' + e.getMessage();
      result.errors = new List<String>{ e.getMessage() };
      return result;
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * @description Fetch all available Coverage records with their field set information
   * @return List of CoverageWrapper objects
   */
  private static List<CoverageWrapper> getCoveragesForInitialization() {
    List<CoverageWrapper> wrappers = new List<CoverageWrapper>();
    List<Coverage__c> coverages = [
      SELECT Id, Name, Field_Set_for_Quote__c
      FROM Coverage__c
      //   WITH SECURITY_ENFORCED
      ORDER BY Name ASC
    ];

    for (Coverage__c coverage : coverages) {
      CoverageWrapper wrapper = new CoverageWrapper();
      wrapper.id = coverage.Id;
      wrapper.name = coverage.Name;
      wrapper.fieldSetName = coverage.Field_Set_for_Quote__c;
      wrappers.add(wrapper);
    }

    return wrappers;
  }

  /**
   * @description Fetch Account Locations with all field values for field mapping
   * Includes field values that may be mapped to Quote_Coverage_Link__c records
   * Uses dynamic SOQL to include all mapped fields
   *
   * @param accountId The Account record Id
   * @return List of LocationWrapper objects
   */
  private static List<LocationWrapper> getAccountLocationsWithFieldValues(
    String accountId
  ) {
    List<LocationWrapper> wrappers = new List<LocationWrapper>();

    // Get the field mappings to know which fields to query
    List<LocationFieldMapping> mappings = getLocationFieldMappings();

    // Build dynamic query to include mapped fields
    Set<String> fieldsToQuery = new Set<String>{ 'Id', 'Name' };
    for (LocationFieldMapping mapping : mappings) {
      fieldsToQuery.add(mapping.locationField);
    }

    String query =
      'SELECT ' +
      String.join(new List<String>(fieldsToQuery), ', ') +
      ' FROM Location__c WHERE Account__c = :accountId ORDER BY Name ASC';

    List<Location__c> locations = Database.query(query);

    for (Location__c location : locations) {
      LocationWrapper wrapper = new LocationWrapper();
      wrapper.id = location.Id;
      wrapper.name = location.Name;

      // Extract mapped field values
      wrapper.fieldValues = new Map<String, Object>();
      for (LocationFieldMapping mapping : mappings) {
        Object value = location.get(mapping.locationField);
        if (value != null) {
          // Store with the Quote_Coverage_Link__c field name as key
          wrapper.fieldValues.put(mapping.quoteCoverageLinkField, value);
        }
      }

      wrappers.add(wrapper);
    }

    return wrappers;
  }

  /**
   * @description Get location field mappings - defines which Location fields map to Quote_Coverage_Link__c fields
   * @return List of LocationFieldMapping objects
   */
  private static List<LocationFieldMapping> getLocationFieldMappings() {
    // Define mappings here - same as NewQuoteCoverageSelectionController
    return new List<LocationFieldMapping>{
      new LocationFieldMapping('Building_Value__c', 'Building_Value__c'),
      new LocationFieldMapping(
        'Business_Personal_Property__c',
        'Business_Personal_Property__c'
      ),
      new LocationFieldMapping('Deductible__c', 'Property_Deductible__c'),
      new LocationFieldMapping(
        'Business_Interruption_allow_text__c',
        'Business_Interruption_allow_text__c'
      )
    };
  }

  /**
   * @description Check if location-based property coverage is enabled
   * Currently returns true if Quote_Coverage_Link__c has Location__c field
   *
   * @return Boolean indicating if feature is enabled
   */
  private static Boolean isLocationBasedPropertyEnabled() {
    // Check if Location__c field exists on Quote_Coverage_Link__c
    // Map<String, Schema.SObjectField> fieldMap = Schema.SObjectType.Quote_Coverage_Link__c.fields.getMap();
    // return fieldMap.containsKey('Location__c');

    return CoverageSelectionController.isLocationBasedPropertyEnabled();
  }

  /**
   * @description Build a map of Coverage records by Id for quick lookup
   * @param selectedCoverages The selected coverage data from the UI
   * @return Map of Coverage__c records keyed by Id
   */
  private static Map<String, Coverage__c> getCoverageMap(
    SelectedCoveragesWrapper selectedCoverages
  ) {
    Set<String> coverageIds = new Set<String>();
    for (SelectedCoverageData cov : selectedCoverages.coverages) {
      coverageIds.add(cov.id);
    }

    Map<String, Coverage__c> coverageMap = new Map<String, Coverage__c>(
      [
        SELECT Id, Name, Field_Set_for_Quote__c
        FROM Coverage__c
        WHERE Id IN :coverageIds
        // WITH SECURITY_ENFORCED
      ]
    );

    return coverageMap;
  }

  /**
   * @description Build a map of Location records by Id for field mapping
   * Uses dynamic query to include all mapped fields
   *
   * @param locationIds Set of Location record Ids to fetch
   * @return Map of Location__c records keyed by Id
   */
  private static Map<String, Location__c> getLocationMapByIds(
    Set<String> locationIds
  ) {
    if (locationIds.isEmpty()) {
      return new Map<String, Location__c>();
    }

    // Get field mappings to know which fields to include
    List<LocationFieldMapping> mappings = getLocationFieldMappings();

    // Build dynamic query with mapped fields
    Set<String> fieldsToQuery = new Set<String>{ 'Id', 'Name' };
    for (LocationFieldMapping mapping : mappings) {
      fieldsToQuery.add(mapping.locationField);
    }

    String query =
      'SELECT ' +
      String.join(new List<String>(fieldsToQuery), ', ') +
      ' FROM Location__c WHERE Id IN :locationIds';

    List<Location__c> locations = Database.query(query);

    Map<String, Location__c> locationMap = new Map<String, Location__c>();
    for (Location__c loc : locations) {
      locationMap.put(loc.Id, loc);
    }

    return locationMap;
  }

  /**
   * @description Check if Property coverage is selected in the selection data
   * @param selectedCoverages The selected coverage data
   * @return Boolean indicating if Property coverage is selected
   */
  private static Boolean isPropertySelected(
    SelectedCoveragesWrapper selectedCoverages
  ) {
    for (SelectedCoverageData cov : selectedCoverages.coverages) {
      if (PROPERTY_COVERAGE_NAME.equalsIgnoreCase(cov.name)) {
        return true;
      }
    }
    return false;
  }

  /**
   * @description Extract Location Ids from selected locations in Property coverage
   * @param selectedCoverages The selected coverage data
   * @return Set of Location record Ids
   */
  private static Set<String> getLocationIdsFromSelection(
    SelectedCoveragesWrapper selectedCoverages
  ) {
    Set<String> locationIds = new Set<String>();

    for (SelectedCoverageData cov : selectedCoverages.coverages) {
      if (
        PROPERTY_COVERAGE_NAME.equalsIgnoreCase(cov.name) &&
        cov.selectedLocations != null
      ) {
        for (SelectedLocationData loc : cov.selectedLocations) {
          locationIds.add(loc.id);
        }
      }
    }

    return locationIds;
  }

  /**
   * @description Build a Quote__c record with auto-populated fields
   * Sets Carrier_Issuing_Company__c and Marketer_UW_Name__c from Opportunity
   * Generates Quote Name from coverage acronyms and creation date
   *
   * @param opp The Opportunity record
   * @param selectedCoverages The selected coverage data
   * @param coverageMap Map of Coverage records
   * @return Quote__c record ready to insert
   */
  private static Quote__c buildQuoteRecord(
    Opportunity opp,
    SelectedCoveragesWrapper selectedCoverages,
    Map<String, Coverage__c> coverageMap
  ) {
    Quote__c newQuote = new Quote__c();
    newQuote.Opportunity__c = opp.Id;
    newQuote.Carrier_Issuing_Company__c = opp.Carrier_Issuing_Company__c;
    newQuote.Marketer_UW_Name__c = opp.Marketer_UW_Name__c;
    newQuote.Status__c = 'Open'; // Default status
    newQuote.Is_New_Property__c = isLocationBasedPropertyEnabled();

    // Set record type based on Opportunity
    try {
      Id scaleRecordTypeId = Schema.SObjectType.Opportunity.getRecordTypeInfosByName()
        .get('Scale')
        .getRecordTypeId();

      if (opp.RecordTypeId == scaleRecordTypeId) {
        newQuote.RecordTypeId = Schema.SObjectType.Quote__c.getRecordTypeInfosByName()
          .get('Scale-Open')
          .getRecordTypeId();
      } else {
        newQuote.RecordTypeId = Schema.SObjectType.Quote__c.getRecordTypeInfosByName()
          .get('Open')
          .getRecordTypeId();
      }
    } catch (Exception e) {
      // If record type lookup fails, leave as default
      System.debug(
        'Warning: Could not set Quote record type: ' + e.getMessage()
      );
    }

    // Generate Quote Name from coverage acronyms + creation date
    // Note: Coverage__c doesn't have Acronym__c, so we use coverage Name instead
    newQuote.Name = buildQuoteName(selectedCoverages, coverageMap);

    return newQuote;
  }

  /**
   * @description Generate Quote Name by concatenating coverage names and creation date
   * Example: "PGLWC-01-15-2026" (based on coverage names, not acronyms, since they're not available)
   *
   * @param selectedCoverages The selected coverage data
   * @param coverageMap Map of Coverage records for lookup
   * @return String representing the generated Quote Name
   */
  private static String buildQuoteName(
    SelectedCoveragesWrapper selectedCoverages,
    Map<String, Coverage__c> coverageMap
  ) {
    String names = '';

    // Collect coverage names and abbreviate them
    for (SelectedCoverageData selectedCov : selectedCoverages.coverages) {
      Coverage__c cov = coverageMap.get(selectedCov.id);
      if (cov != null && String.isNotBlank(cov.Name)) {
        // Use first letter of each coverage name
        names += cov.Name.substring(0, 1).toUpperCase();
      }
    }

    // Append creation date in MM-DD-YYYY format
    String dateStr = System.today().format(); // Returns MM/DD/YYYY
    dateStr = dateStr.replace('/', '-'); // Convert to MM-DD-YYYY

    return names + '-' + dateStr;
  }

  /**
   * @description Build Quote_Coverage_Link__c records for all selected coverages
   * For Property coverage with locations: creates one record per selected location with field mapping
   * For non-Property coverages: creates single record with blank fields (as if user left them empty)
   *
   * @param quoteId The newly created Quote record Id
   * @param selectedCoverages The selected coverage data
   * @param coverageMap Map of Coverage records
   * @param locationMap Map of Location records for field mapping
   * @return List of Quote_Coverage_Link__c records
   */
  private static List<Quote_Coverage_Link__c> buildQuoteCoverageLinks(
    String quoteId,
    SelectedCoveragesWrapper selectedCoverages,
    Map<String, Coverage__c> coverageMap,
    Map<String, Location__c> locationMap
  ) {
    List<Quote_Coverage_Link__c> coverageLinks = new List<Quote_Coverage_Link__c>();
    List<LocationFieldMapping> mappings = getLocationFieldMappings();

    for (SelectedCoverageData selectedCov : selectedCoverages.coverages) {
      Coverage__c coverage = coverageMap.get(selectedCov.id);
      if (coverage == null) {
        continue; // Skip if coverage not found
      }

      if (PROPERTY_COVERAGE_NAME.equalsIgnoreCase(coverage.Name)) {
        // Property coverage: create one link per selected location with field mapping
        if (
          selectedCov.selectedLocations != null &&
          !selectedCov.selectedLocations.isEmpty()
        ) {
          for (
            SelectedLocationData selectedLoc : selectedCov.selectedLocations
          ) {
            Location__c location = locationMap.get(selectedLoc.id);
            if (location != null) {
              Quote_Coverage_Link__c link = buildPropertyCoverageLink(
                quoteId,
                coverage,
                location,
                mappings
              );
              coverageLinks.add(link);
            }
          }
        }
      } else {
        // Non-Property coverage: create single link with blank fields
        Quote_Coverage_Link__c link = buildBasicCoverageLink(quoteId, coverage);
        coverageLinks.add(link);
      }
    }

    return coverageLinks;
  }

  /**
   * @description Build a Quote_Coverage_Link__c record for Property coverage with location field mapping
   * Maps fields from the Location record to the Quote_Coverage_Link__c record using the defined mappings
   *
   * @param quoteId The Quote record Id
   * @param coverage The Coverage record
   * @param location The Location record
   * @param mappings List of field mappings from Location to Quote_Coverage_Link__c
   * @return Quote_Coverage_Link__c record with mapped fields
   */
  private static Quote_Coverage_Link__c buildPropertyCoverageLink(
    String quoteId,
    Coverage__c coverage,
    Location__c location,
    List<LocationFieldMapping> mappings
  ) {
    Quote_Coverage_Link__c link = new Quote_Coverage_Link__c();
    link.Quote__c = quoteId;
    link.Location__c = location.Id;
    link.Name = coverage.Name;

    // Map Location field values to Quote_Coverage_Link__c fields using the mappings
    for (LocationFieldMapping mapping : mappings) {
      Object value = location.get(mapping.locationField);
      if (value != null) {
        try {
          link.put(mapping.quoteCoverageLinkField, value);
        } catch (Exception e) {
          // If field doesn't exist or can't be set, skip it
          System.debug(
            'Warning: Could not map field ' +
              mapping.locationField +
              ': ' +
              e.getMessage()
          );
        }
      }
    }

    return link;
  }

  /**
   * @description Build a basic Quote_Coverage_Link__c record for non-Property coverage
   * All fields are left blank (null) as if user did not fill them in
   *
   * @param quoteId The Quote record Id
   * @param coverage The Coverage record
   * @return Quote_Coverage_Link__c record with basic fields only
   */
  private static Quote_Coverage_Link__c buildBasicCoverageLink(
    String quoteId,
    Coverage__c coverage
  ) {
    Quote_Coverage_Link__c link = new Quote_Coverage_Link__c();
    link.Quote__c = quoteId;
    link.Name = coverage.Name;
    // All other fields left blank

    return link;
  }

  // ==================== WRAPPER CLASSES ====================

  /**
   * Wrapper class for initialization data response
   */
  public class StreamlinedInitWrapper {
    @AuraEnabled
    public String opportunityId;
    @AuraEnabled
    public String accountId;
    @AuraEnabled
    public String accountName;
    @AuraEnabled
    public String recordTypeName;
    @AuraEnabled
    public Boolean isScale;
    @AuraEnabled
    public String raterType;
    @AuraEnabled
    public List<CoverageWrapper> coverages;
    @AuraEnabled
    public List<LocationWrapper> locations;
    @AuraEnabled
    public Boolean isLocationBasedPropertyEnabled;
  }

  /**
   * Wrapper class for Coverage information
   */
  public class CoverageWrapper {
    @AuraEnabled
    public String id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String fieldSetName;
  }

  /**
   * Wrapper class for Location information
   */
  public class LocationWrapper {
    @AuraEnabled
    public String id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Map<String, Object> fieldValues;
  }

  /**
   * Wrapper class for location field mapping configuration
   */
  public class LocationFieldMapping {
    public String locationField { get; set; }
    public String quoteCoverageLinkField { get; set; }

    public LocationFieldMapping(
      String locationField,
      String quoteCoverageLinkField
    ) {
      this.locationField = locationField;
      this.quoteCoverageLinkField = quoteCoverageLinkField;
    }
  }

  /**
   * Wrapper class for the selected coverages and locations from the UI
   */
  public class SelectedCoveragesWrapper {
    @AuraEnabled
    public List<SelectedCoverageData> coverages;
  }

  /**
   * Wrapper class for individual coverage selection data
   */
  public class SelectedCoverageData {
    @AuraEnabled
    public String id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String acronym;
    @AuraEnabled
    public List<SelectedLocationData> selectedLocations;
  }

  /**
   * Wrapper class for individual location selection data
   */
  public class SelectedLocationData {
    @AuraEnabled
    public String id;
    @AuraEnabled
    public String name;
  }

  /**
   * Wrapper class for Quote creation result
   */
  public class CreateQuoteResult {
    @AuraEnabled
    public Boolean isSuccess;
    @AuraEnabled
    public String quoteId;
    @AuraEnabled
    public String message;
    @AuraEnabled
    public List<String> errors = new List<String>();
  }
}
