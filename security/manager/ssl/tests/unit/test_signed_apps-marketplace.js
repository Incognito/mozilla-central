"use strict";

const isB2G = ("@mozilla.org/b2g-keyboard;1" in Components.classes);

do_get_profile(); // must be called before getting nsIX509CertDB
const certdb = Cc["@mozilla.org/security/x509certdb;1"].getService(Ci.nsIX509CertDB);

function run_test() {
  run_next_test();
}

// XXX: NSS has many possible error codes for this, e.g.
// SEC_ERROR_UNTRUSTED_ISSUER and others are also reasonable. Future
// versions of NSS may return one of these alternate errors; in that case
// we need to update this test.
//
// XXX (bug 812089): Cr.NS_ERROR_SEC_ERROR_UNKNOWN_ISSUER is undefined.
//
// XXX: Cannot use operator| instead of operator+ to combine bits because
// bit 31 trigger's JavaScript's crazy interpretation of the numbers as
// two's complement negative integers.
const NS_ERROR_SEC_ERROR_UNKNOWN_ISSUER = 0x80000000 /*unsigned (1 << 31)*/
				        + (    (0x45 + 21) << 16)
				        + (-(-0x2000 + 13)      );

function check_open_result(name, expectedRv) {
  if (expectedRv == Cr.NS_OK && !isB2G) {
    // We do not trust the marketplace trust anchor on non-B2G builds
    expectedRv = NS_ERROR_SEC_ERROR_UNKNOWN_ISSUER;
  }

  return function openSignedJARFileCallback(rv, aZipReader, aSignerCert) {
    do_print("openSignedJARFileCallback called for " + name);
    do_check_eq(rv, expectedRv);
    do_check_eq(aZipReader != null,  Components.isSuccessCode(expectedRv));
    do_check_eq(aSignerCert != null, Components.isSuccessCode(expectedRv));
    run_next_test();
  };
}

function original_app_path(test_name) {
  return do_get_file("test_signed_apps/" + test_name + ".zip", false);
}

// Test that we no longer trust the test root cert that was originally used
// during development of B2G 1.0.
add_test(function () {
  certdb.openSignedJARFileAsync(
    original_app_path("test-privileged-app-test-1.0"),
    check_open_result("test-privileged-app-test-1.0",
                      NS_ERROR_SEC_ERROR_UNKNOWN_ISSUER));
});

// Test that we trust the root cert used by by the Firefox Marketplace.
add_test(function () {
  certdb.openSignedJARFileAsync(
    original_app_path("privileged-app-test-1.0"),
    check_open_result("privileged-app-test-1.0", Cr.NS_OK));
});
