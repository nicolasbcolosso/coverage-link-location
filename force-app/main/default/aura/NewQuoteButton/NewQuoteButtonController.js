({
  doInit: function (component, event, helper) {
    var action = component.get("c.isLocationBasedPropertyEnabled");
    action.setCallback(this, function (response) {
      if (response.getState() === "SUCCESS") {
        component.set("v.isNewProperty", response.getReturnValue());
      } else {
        var errors = response.getError();
        console.log("checkIsNewPropertyEnabledGlobal error", errors);
      }
    });
    $A.enqueueAction(action);
  }
});
